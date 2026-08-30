"""Versioned NDJSON bridge backed by the pinned DeepTutor runtime.

The bridge owns only process framing and the host boundary.  The turn loop is
the upstream DeepTutor ``AgentLoop`` from the pinned vendor copy; Omni-Edu
adapts its ``StreamBus`` events into the public Xiaozhi event envelope.
"""

from __future__ import annotations

import asyncio
import json
import re
import sys
import threading
from dataclasses import dataclass
from pathlib import Path
from queue import Empty, Queue
from types import SimpleNamespace
from typing import Any, AsyncIterator

from . import __version__

MAX_FRAME_BYTES = 1_000_000
MAX_PROMPT_CHARS = 20_000
MAX_CONTEXT_KEYS = 64
TURN_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,120}$")
CAPABILITIES = {
    "chat": {"version": "1.5.11", "readOnly": True, "engine": "deeptutor-agent-loop"},
    "deep_solve": {"version": "1.5.11", "readOnly": True, "engine": "deeptutor-capability"},
    "deep_question": {"version": "1.5.11", "readOnly": True, "engine": "deeptutor-capability"},
    "deep_research": {"version": "1.5.11", "readOnly": True, "engine": "deeptutor-capability"},
    "visualize": {"version": "1.5.11", "readOnly": True, "engine": "deeptutor-capability"},
    "mastery_path": {"version": "1.5.11", "readOnly": True, "engine": "deeptutor-capability"},
}
UPSTREAM_COMMIT = "456f9c24226e008f1ff07a7e3455d7b4d39f6221"


class BudgetExceeded(RuntimeError):
    """Internal control flow used to stop an AgentLoop at its event budget."""


@dataclass
class TurnState:
    turn_id: str
    max_events: int = 32
    terminal: bool = False
    failed: bool = False
    budget_exhausted: bool = False
    sequence: int = 0
    cancel_event: threading.Event | None = None


class _FakeStream:
    """Small OpenAI-compatible async stream used by protocol dry-runs.

    It deliberately exercises the real DeepTutor loop without making a
    network request.  Production model calls will be wired through the host
    model/tool proxy in the next integration pack.
    """

    def __init__(self, text: str) -> None:
        self._text = text

    def __aiter__(self) -> AsyncIterator[Any]:
        async def _items() -> AsyncIterator[Any]:
            yield SimpleNamespace(
                choices=[SimpleNamespace(delta=SimpleNamespace(content=self._text), finish_reason=None)],
                usage=None,
            )
            yield SimpleNamespace(
                choices=[SimpleNamespace(delta=SimpleNamespace(content=None), finish_reason="stop")],
                usage=None,
            )

        return _items()

    async def close(self) -> None:
        return None


class _FakeCompletions:
    def __init__(self, text: str) -> None:
        self._text = text

    async def create(self, **_: Any) -> _FakeStream:
        return _FakeStream(self._text)


class _FakeClient:
    def __init__(self, text: str) -> None:
        self.chat = SimpleNamespace(completions=_FakeCompletions(text))


class _CapabilityFakeCompletions:
    """Deterministic provider fixture for exercising real capability pipelines.

    The capability code, label protocols, parsers, and result envelopes still
    come from the pinned DeepTutor source.  Only the network boundary is
    replaced, so smoke tests can cover question/research behavior without
    inventing a successful live-provider result.
    """

    def __init__(self, capability: str) -> None:
        self._capability = capability
        self._call_count = 0

    def _response_text(self, messages: list[dict[str, Any]]) -> str:
        self._call_count += 1
        text = "\n".join(str(item.get("content") or "") for item in messages[-4:] if isinstance(item, dict))
        lowered = text.lower()
        if self._capability == "deep_question":
            if "出题规划器" in text or "阶段 2" in text or "plan:" in lowered:
                return "PLAN\n" + json.dumps({
                    "analysis": "围绕当前知识点生成一组基础概念题。",
                    "templates": [{"topic": "当前知识点核心概念", "question_type": "short_answer", "difficulty": "medium"}],
                }, ensure_ascii=False)
            if "正在写" in text or "本题 template" in lowered or "question_id:" in lowered:
                return "FINISH\n" + json.dumps({
                    "question": "请用一句话说明这个知识点的核心概念。",
                    "correct_answer": "核心概念应能解释定义、条件和一个最小例子。",
                    "explanation": "检查学生是否抓住定义与应用边界。",
                    "question_type": "short_answer",
                    "difficulty": "medium",
                }, ensure_ascii=False)
            return "FINISH\n已完成知识点范围探索，将按当前难度生成练习题。"
        if self._capability == "deep_research":
            if "section" in lowered:
                return "SECTION\n该部分整理了与主题直接相关的教学证据，并标注了证据边界。"
            if "conclusion" in lowered or "结论" in text:
                return "CONCLUSION\n结论仅适用于当前教师教研范围，仍需结合本地资料复核。"
            if "intro" in lowered or "引言" in text:
                return "INTRO\n本报告从问题定义、证据来源和课堂应用三个方面展开。"
            if "outline" in lowered or "subtopic" in lowered or "decompose" in lowered or "提纲" in text:
                return "OUTLINE\n" + json.dumps([{"title": "核心概念与证据边界", "overview": "定义主题并列出可验证资料。"}], ensure_ascii=False)
            return "FINISH\n主题已澄清，准备进入教师可审阅的研究提纲。"
        if self._capability == "visualize":
            # Keep the upstream analysis/code/review stages real while
            # returning the smallest safe renderable fixture for offline
            # smoke. Mermaid avoids executable HTML/SVG in the test path.
            if self._call_count >= 2:
                return "```mermaid\ngraph TD\n  A[分子] --> C[分数值]\n  B[分母] --> C\n```"
            if self._call_count == 1:
                return json.dumps({
                    "render_type": "mermaid",
                    "visual_genre": "flowchart",
                    "description": "分数概念关系图",
                    "data_description": "分子、分母与分数值的关系",
                    "chart_type": "flowchart",
                    "visual_elements": ["分子", "分母", "分数值"],
                    "rationale": "用结构图表达概念关系",
                }, ensure_ascii=False)
            return json.dumps({"optimized_code": "graph TD\n  A[分子] --> C[分数值]\n  B[分母] --> C", "changed": False, "review_notes": "Passed local validation."}, ensure_ascii=False)
        return ""

    async def create(self, *, messages: list[dict[str, Any]], **_: Any) -> _FakeStream:
        return _FakeStream(self._response_text(messages))


class _CapabilityFakeClient:
    def __init__(self, capability: str) -> None:
        self.chat = SimpleNamespace(completions=_CapabilityFakeCompletions(capability))


class _HostCompletionService:
    """Adapter for DeepTutor BaseAgent's ``services.llm.complete`` seam."""

    def __init__(self, bridge: "Bridge", state: TurnState, *, capability: str) -> None:
        self._bridge = bridge
        self._state = state
        self._capability = capability

    async def __call__(self, *, prompt: str, system_prompt: str, **kwargs: Any) -> str:
        response = await self._bridge._request_model(
            self._state,
            capability=self._capability,
            kwargs={
                "model": kwargs.get("model"),
                "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}],
                "temperature": kwargs.get("temperature"),
                "max_tokens": kwargs.get("max_tokens") or kwargs.get("max_completion_tokens"),
            },
        )
        choices = response.get("choices") if isinstance(response, dict) else []
        choice = choices[0] if isinstance(choices, list) and choices else {}
        message = choice.get("message") if isinstance(choice, dict) else {}
        content = message.get("content") if isinstance(message, dict) else ""
        if isinstance(content, (dict, list)):
            return json.dumps(content, ensure_ascii=False)
        return str(content or "")


class _AutoToolStream:
    """Deterministic native tool-call stream for the host-boundary smoke.

    This is intentionally only a parity fixture: the *parsing, loop and
    dispatch* are upstream DeepTutor; the fake provider makes the boundary
    test independent from network credentials.
    """

    def __init__(self, *, tool_name: str | None, arguments: dict[str, Any], final_text: str) -> None:
        self._tool_name = tool_name
        self._arguments = arguments
        self._final_text = final_text

    def __aiter__(self) -> AsyncIterator[Any]:
        async def _items() -> AsyncIterator[Any]:
            if self._tool_name:
                yield SimpleNamespace(
                    choices=[SimpleNamespace(delta=SimpleNamespace(
                        content="我先核对本地学生资料。",
                        tool_calls=[SimpleNamespace(
                            index=0,
                            id="call_host_proxy_1",
                            function=SimpleNamespace(
                                name=self._tool_name,
                                arguments=json.dumps(self._arguments, ensure_ascii=False),
                            ),
                        )],
                    ), finish_reason=None)],
                    usage=None,
                )
                yield SimpleNamespace(
                    choices=[SimpleNamespace(delta=SimpleNamespace(content=None), finish_reason="tool_calls")],
                    usage=None,
                )
                return
            yield SimpleNamespace(
                choices=[SimpleNamespace(delta=SimpleNamespace(content=self._final_text), finish_reason=None)],
                usage=None,
            )
            yield SimpleNamespace(
                choices=[SimpleNamespace(delta=SimpleNamespace(content=None), finish_reason="stop")],
                usage=None,
            )

        return _items()

    async def close(self) -> None:
        return None


class _AutoToolCompletions:
    def __init__(self, *, tool_name: str, arguments: dict[str, Any], final_text: str) -> None:
        self._tool_name = tool_name
        self._arguments = arguments
        self._final_text = final_text

    async def create(self, *, messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None, **_: Any) -> _AutoToolStream:
        has_tool_observation = any(message.get("role") == "tool" for message in messages)
        return _AutoToolStream(
            tool_name=self._tool_name if tools and not has_tool_observation else None,
            arguments=self._arguments,
            final_text=self._final_text,
        )


class _AutoToolClient:
    def __init__(self, *, tool_name: str, arguments: dict[str, Any], final_text: str) -> None:
        self.chat = SimpleNamespace(completions=_AutoToolCompletions(tool_name=tool_name, arguments=arguments, final_text=final_text))


class _HostModelStream:
    """Adapt one host-owned completion into the stream shape AgentLoop uses."""

    def __init__(self, response: dict[str, Any]) -> None:
        self._response = response

    def __aiter__(self) -> AsyncIterator[Any]:
        async def _items() -> AsyncIterator[Any]:
            choices = self._response.get("choices") if isinstance(self._response, dict) else []
            choice = choices[0] if isinstance(choices, list) and choices else {}
            message = choice.get("message") if isinstance(choice, dict) else {}
            message = message if isinstance(message, dict) else {}
            content = message.get("content")
            raw_tool_calls = message.get("tool_calls")
            tool_calls: list[Any] = []
            if isinstance(raw_tool_calls, list):
                for index, raw in enumerate(raw_tool_calls[:8]):
                    item = raw if isinstance(raw, dict) else {}
                    function = item.get("function") if isinstance(item.get("function"), dict) else {}
                    tool_calls.append(SimpleNamespace(
                        index=index,
                        id=str(item.get("id") or f"host_call_{index}"),
                        function=SimpleNamespace(
                            name=str(function.get("name") or ""),
                            arguments=str(function.get("arguments") or "{}"),
                        ),
                    ))
            yield SimpleNamespace(
                choices=[SimpleNamespace(
                    delta=SimpleNamespace(content=content, tool_calls=tool_calls),
                    finish_reason=str(choice.get("finish_reason") or ("tool_calls" if tool_calls else "stop")),
                )],
                usage=self._response.get("usage"),
            )

        return _items()

    async def close(self) -> None:
        return None


class _HostModelCompletions:
    def __init__(self, bridge: "Bridge", state: TurnState, *, capability: str) -> None:
        self._bridge = bridge
        self._state = state
        self._capability = capability

    async def create(self, **kwargs: Any) -> _HostModelStream:
        response = await self._bridge._request_model(self._state, capability=self._capability, kwargs=kwargs)
        return _HostModelStream(response)


class _HostModelClient:
    def __init__(self, bridge: "Bridge", state: TurnState, *, capability: str) -> None:
        self.chat = SimpleNamespace(completions=_HostModelCompletions(bridge, state, capability=capability))


class _HostProxyTool:
    """DeepTutor BaseTool whose execution is always delegated to Electron."""

    def __init__(self, bridge: "Bridge", state: TurnState, *, capability: str, prompt: str, tool_name: str, description: str = "", parameters: dict[str, Any] | None = None) -> None:
        self._bridge = bridge
        self._state = state
        self._capability = capability
        self._prompt = prompt
        self._tool_name = tool_name
        self._description = description or "通过 Omni-Edu 宿主审核后执行的只读工具。"
        self._parameters = parameters if isinstance(parameters, dict) else {
            "type": "object",
            "properties": {"studentName": {"type": "string", "description": "学生显示名"}},
            "required": [],
            "additionalProperties": False,
        }

    @property
    def name(self) -> str:
        return self._tool_name

    def get_definition(self) -> Any:
        from deeptutor.core.tool_protocol import ToolDefinition

        return ToolDefinition(
            name=self._tool_name,
            description=self._description,
            raw_parameters=self._parameters,
        )

    def get_prompt_hints(self, language: str = "zh") -> Any:
        from deeptutor.core.tool_protocol import ToolPromptHints

        return ToolPromptHints(
            short_description=self._description,
            when_to_use="只有当前任务和 route 允许时使用；所有调用必须经过宿主审核",
            input_format="JSON schema",
        )

    async def execute(self, **kwargs: Any) -> Any:
        from deeptutor.core.tool_protocol import ToolResult

        safe_arguments = {
            key: value
            for key, value in kwargs.items()
            if not key.startswith("_") and key != "event_sink"
        }
        try:
            safe_arguments = json.loads(json.dumps(safe_arguments, ensure_ascii=False))
        except (TypeError, ValueError):
            safe_arguments = {}
        if self._tool_name == "ask_user":
            question = str(safe_arguments.get("question") or self._prompt or "请补充必要信息。")[:2_000]
            raw_questions = safe_arguments.get("questions") if isinstance(safe_arguments.get("questions"), list) else []
            result = await self._bridge._request_user_input(
                self._state,
                prompt=question,
                questions=raw_questions,
            )
            status = str(result.get("status") or "expired")
            return ToolResult(
                content=json.dumps(result, ensure_ascii=False)[:4_000],
                success=status == "answered",
                metadata={"hostTool": self._tool_name, "status": status, "userInput": True},
            )
        result = await self._bridge._request_host_tool(
            self._state,
            capability=self._capability,
            prompt=self._prompt,
            tool_name=self._tool_name,
            arguments=safe_arguments,
        )
        status = str(result.get("status") or "failed")
        return ToolResult(
            content=json.dumps(result, ensure_ascii=False)[:4000],
            success=status == "used",
            metadata={"hostTool": self._tool_name, "status": status},
        )


class _SingleToolLookup:
    """Host tool catalog with explicit progressive schema disclosure.

    The sidecar receives the host-owned catalog, but only ``initial_names``
    are exposed to the upstream AgentLoop. ``load_tools`` can activate a
    bounded subset after Electron has applied its own route/context review.
    The catalog never grants a permission that was absent from the host list.
    """

    def __init__(self, tool: _HostProxyTool | list[_HostProxyTool], initial_names: list[str] | None = None) -> None:
        self._tools = tool if isinstance(tool, list) else [tool]
        available = {item.name for item in self._tools}
        self._visible_names = set(initial_names or available) & available

    def get(self, name: str) -> Any:
        if name not in self._visible_names:
            return None
        return next((tool for tool in self._tools if name == tool.name), None)

    def get_enabled(self, names: list[str]) -> list[Any]:
        return [tool for tool in self._tools if tool.name in names]

    def get_definitions(self, names: list[str] | None = None) -> list[Any]:
        selected = self._visible_names if names is None else self._visible_names.intersection(names)
        return [tool.get_definition() for tool in self._tools if tool.name in selected]

    def deferred_tools(self) -> list[Any]:
        return []

    def list_tools(self) -> list[str]:
        return [tool.name for tool in self._tools if tool.name in self._visible_names]

    def build_openai_schemas(self, names: list[str] | None = None) -> list[dict[str, Any]]:
        return [definition.to_openai_schema() for definition in self.get_definitions(names)]

    def activate(self, names: list[str]) -> list[str]:
        available = {item.name for item in self._tools}
        self._visible_names.update(name for name in names if name in available)
        return self.list_tools()

    async def execute(self, name: str, /, **kwargs: Any) -> Any:
        tool = self.get(name)
        if tool is None:
            raise KeyError(f"Unknown host proxy tool: {name}")
        return await tool.execute(**kwargs)


AGENT_LOOP_MAX_TOKENS = 8_000
FINAL_RESULT_DETAIL_LIMIT = 64_000


class _DryRunPipeline:
    """Adapter implementing the narrow pipeline seam used by AgentLoop."""

    binding = "openai"
    model = "omni-edu-deeptutor-dry-run"
    usage = None
    # xiazhi.reply.v2 contains the teacher-facing answer plus evidence, risks,
    # actions and route metadata. 512 tokens routinely cuts the JSON before
    # its closing brace; use the same bounded ceiling enforced by the host.
    loop_max_tokens = AGENT_LOOP_MAX_TOKENS

    def __init__(self, prompt: str, language: str, tool_lookup: Any | None = None, system_prompt: str = "", tool_schemas: list[dict[str, Any]] | None = None, enabled_tools: list[str] | None = None) -> None:
        self._prompt = prompt
        self.language = language
        self.tool_lookup = tool_lookup
        self._system_prompt = system_prompt
        self._tool_schemas = tool_schemas
        self._enabled_tools = enabled_tools

    async def _capability_pre_loop_briefings(self, *_: Any) -> str:
        return ""

    def _capability_pre_loop_seed(self, *_: Any) -> str:
        return ""

    async def _retrieve_kb_seed_block(self, *_: Any) -> str:
        return ""

    def _build_loop_messages(self, *, context: Any, **_: Any) -> list[dict[str, Any]]:
        return [
            {
                "role": "system",
                "content": self._system_prompt or (
                    "你是小智教育 AI。仅基于可用证据回答；若没有证据，明确说明未知，"
                    "不要伪造学生数据。当前为 DeepTutor AgentLoop dry-run。"
                ),
            },
            {"role": "user", "content": context.user_message},
        ]

    async def _guard_context_window(self, *_: Any) -> None:
        return None

    def _completion_kwargs(self, *, max_tokens: int) -> dict[str, Any]:
        return {"temperature": 0, "max_tokens": max_tokens}

    def effective_max_rounds(self, _context: Any) -> int:
        return 2

    def _t(self, _key: str, default: str = "", **_: Any) -> str:
        return default

    def _finish_exhausted_instruction(self) -> str:
        return "请直接给出最终教育答复，并说明证据边界。"

    def _settle_exhausted_instruction(self) -> str:
        return "请完成必要步骤后给出最终答复。"

    async def _dispatch_tool_calls(self, *, tool_calls: list[dict[str, Any]], context: Any, stream: Any, iteration_index: int, stage: str = "responding") -> Any:
        from deeptutor.core.agentic import dispatch_tool_calls

        if self.tool_lookup is None:
            raise RuntimeError("dry-run tool calls require an explicit host proxy registry")
        dispatch = await dispatch_tool_calls(
            tool_calls=tool_calls,
            context=context,
            stream=stream,
            source="chat",
            stage=stage,
            iteration_index=iteration_index,
            registry=self.tool_lookup,
            tool_call_label="调用宿主工具",
            retrieve_label="检索",
            empty_tool_result_message="宿主工具没有返回内容。",
            unknown_error_message_factory=lambda name: f"宿主工具 {name} 执行失败。",
            trace_id_prefix="omni-host",
        )
        # ``load_tools`` is itself host-reviewed. Once its bounded result
        # names are returned, update the mutable schema list consumed by the
        # upstream AgentLoop; no vendor file or permission list is changed.
        if self.tool_lookup is not None and hasattr(self.tool_lookup, "activate"):
            for message in dispatch.tool_messages:
                if str(message.get("name") or "") != "load_tools":
                    continue
                try:
                    payload = json.loads(str(message.get("content") or "{}"))
                except (TypeError, ValueError):
                    continue
                result = payload.get("modelResult") if isinstance(payload, dict) and isinstance(payload.get("modelResult"), dict) else {}
                names = result.get("loadedToolNames") if isinstance(result, dict) else []
                if not isinstance(names, list):
                    continue
                self.tool_lookup.activate([str(name) for name in names[:12]])
                if self._enabled_tools is not None:
                    self._enabled_tools[:] = self.tool_lookup.list_tools()
                if self._tool_schemas is not None:
                    self._tool_schemas[:] = self.tool_lookup.build_openai_schemas(self.tool_lookup.list_tools())
        return dispatch

    async def _emit_protocol_fallback_final_response(self, *_: Any) -> None:
        return None

    async def _emit_terminator_final_response(self, *_: Any) -> None:
        return None

    async def _await_user_reply_and_resolve(self, **_: Any) -> bool:
        return False

    def measure_context_budget(self, *_: Any) -> None:
        return None


class Bridge:
    def __init__(self) -> None:
        self._turns: dict[str, TurnState] = {}
        self._running = True
        self._write_lock = threading.Lock()
        self._threads: set[threading.Thread] = set()
        self._host_results: dict[str, Queue[dict[str, Any]]] = {}
        self._host_results_lock = threading.Lock()
        self._model_results: dict[str, Queue[dict[str, Any]]] = {}
        self._model_results_lock = threading.Lock()
        self._user_input_results: dict[str, Queue[dict[str, Any]]] = {}
        self._user_input_turns: dict[str, str] = {}
        self._user_input_results_lock = threading.Lock()
        # DeepTutor's legacy capability modules resolve AgenticChatPipeline
        # through a module global.  The adapter temporarily swaps that class
        # to inject the host-owned model boundary, so concurrent solve/mastery
        # turns must serialize the swap/restore window rather than race over
        # the process-global symbol.
        self._capability_pipeline_patch_lock = threading.Lock()
        self._load_upstream()

    @staticmethod
    def _load_upstream() -> None:
        vendor_root = Path(__file__).resolve().parents[1] / "vendor"
        # The vendor copy is the default.  A source checkout can be selected
        # explicitly for source-comparison tests without becoming a runtime
        # dependency of the packaged app.
        import os

        override = os.environ.get("DEEPTUTOR_SOURCE_ROOT", "").strip()
        root = Path(override) if override else vendor_root
        if root.name == "deeptutor":
            root = root.parent
        sys.path.insert(0, str(root))

    @staticmethod
    def _write(payload: dict[str, Any]) -> None:
        encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        # stdout is shared by the request reader and background turn threads.
        # The lock is injected by ``handle`` through a class-level fallback.
        lock = getattr(Bridge, "_stdout_lock", None)
        if lock is None:
            sys.stdout.write(encoded + "\n")
            sys.stdout.flush()
            return
        with lock:
            sys.stdout.write(encoded + "\n")
            sys.stdout.flush()

    def _response(
        self,
        request_id: str,
        *,
        result: dict[str, Any] | None = None,
        code: str | None = None,
        message: str | None = None,
        retryable: bool = False,
    ) -> None:
        if code:
            self._write({"type": "response", "id": request_id, "ok": False, "error": {"code": code, "message": message or code, "retryable": retryable}})
            return
        self._write({"type": "response", "id": request_id, "ok": True, "result": result or {}})

    def _event(self, state: TurnState, phase: str, status: str, label: str, detail: str, summary: dict[str, Any] | None = None) -> None:
        if state.budget_exhausted:
            raise BudgetExceeded("DeepTutor event budget exhausted")
        if state.sequence >= state.max_events:
            state.budget_exhausted = True
            state.failed = True
            state.terminal = True
            if state.cancel_event is not None:
                state.cancel_event.set()
            state.sequence += 1
            self._write({"type": "event", "event": {"schemaVersion": "xiazhi.capability.event.v1", "turnId": state.turn_id, "sequence": state.sequence, "phase": "done", "status": "failed", "label": "DeepTutor event budget exhausted", "detail": f"Sidecar stopped after {state.max_events} events; no continuation token is available yet.", "publicSummary": {"terminationReason": "budget_exhausted", "maxEvents": state.max_events, "persistedEvents": state.max_events, "continuationAvailable": False, "hardStop": True}}})
            raise BudgetExceeded("DeepTutor event budget exhausted")
        state.sequence += 1
        self._write({"type": "event", "event": {"schemaVersion": "xiazhi.capability.event.v1", "turnId": state.turn_id, "sequence": state.sequence, "phase": phase, "status": status, "label": label, "detail": detail, "publicSummary": summary or {}}})

    @staticmethod
    def _manifest() -> dict[str, Any]:
        try:
            from deeptutor.runtime.registry.capability_registry import get_capability_registry

            manifests = get_capability_registry().get_manifests()
            names = {str(item.get("name")) for item in manifests}
        except Exception:
            names = set()
        return {
            "schemaVersion": "xiazhi.capability.manifest.v1",
            "bridgeProtocol": "xiazhi.bridge.v1",
            "sidecarVersion": __version__,
            "upstreamCommit": UPSTREAM_COMMIT,
            "runtime": "DeepTutor.AgentLoop",
            "capabilities": [
                {"name": name, **metadata, "enabled": name in names or name == "chat"}
                for name, metadata in CAPABILITIES.items()
            ],
        }

    @staticmethod
    def _validate_turn(params: dict[str, Any]) -> tuple[str | None, str | None]:
        turn_id = params.get("turnId")
        if not isinstance(turn_id, str) or not TURN_ID_RE.fullmatch(turn_id):
            return None, "turnId must be 1-120 ASCII characters from [A-Za-z0-9._:-]."
        prompt = params.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            return None, "prompt is required."
        if len(prompt) > MAX_PROMPT_CHARS:
            return None, f"prompt exceeds {MAX_PROMPT_CHARS} characters."
        context = params.get("context", {})
        if not isinstance(context, dict) or len(context) > MAX_CONTEXT_KEYS:
            return None, f"context must be an object with at most {MAX_CONTEXT_KEYS} keys."
        capability = params.get("capability")
        if capability not in CAPABILITIES:
            return None, "capability is not enabled by this sidecar."
        budgets = params.get("budgets", {})
        if not isinstance(budgets, dict):
            return None, "budgets must be an object."
        max_events = budgets.get("maxEvents", 32)
        max_wall_ms = budgets.get("maxWallMs", 120_000)
        if not isinstance(max_events, int) or not 1 <= max_events <= 256:
            return None, "budgets.maxEvents must be between 1 and 256."
        if not isinstance(max_wall_ms, int) or not 1 <= max_wall_ms <= 120_000:
            return None, "budgets.maxWallMs must be between 1 and 120000."
        return turn_id, None

    async def _request_host_tool(
        self,
        state: TurnState,
        *,
        capability: str,
        prompt: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        """Round-trip one DeepTutor tool execution through Electron main."""
        if not tool_name or not isinstance(arguments, dict):
            return {
                "schemaVersion": "xiazhi.host_tool.result.v1",
                "requestId": "invalid",
                "turnId": state.turn_id,
                "status": "blocked",
                "review": {"ok": False, "reason": "toolName and arguments are required.", "errors": ["invalid_host_tool_request"]},
                "modelResult": {"ok": False},
            }
        request_id = f"host_{state.turn_id}_{state.sequence + 1}"
        waiter: Queue[dict[str, Any]] = Queue(maxsize=1)
        with self._host_results_lock:
            self._host_results[request_id] = waiter
        self._event(state, "tool_request", "awaiting_host", "等待宿主工具审核", "DeepTutor 请求由 Electron main 审核并执行。", {"requestId": request_id, "toolName": tool_name, "source": "agent_loop"})
        self._write({"type": "host_tool_request", "request": {"schemaVersion": "xiazhi.host_tool.request.v1", "requestId": request_id, "turnId": state.turn_id, "capability": capability, "prompt": prompt, "toolName": tool_name, "arguments": arguments}})
        try:
            result = await asyncio.to_thread(waiter.get, True, 120)
        except (Empty, TimeoutError):
            result = {"schemaVersion": "xiazhi.host_tool.result.v1", "requestId": request_id, "turnId": state.turn_id, "status": "failed", "review": {"ok": False, "reason": "HostToolProxy timed out.", "errors": ["host_tool_timeout"]}, "modelResult": {"ok": False}}
        finally:
            with self._host_results_lock:
                self._host_results.pop(request_id, None)
        if tool_name == "mastery_quiz" and str(result.get("status") or "") == "used":
            public = result.get("modelResult") if isinstance(result.get("modelResult"), dict) else {}
            question_id = str(public.get("questionId") or "")
            stem = str(public.get("stem") or "请回答这道掌握度小测。")[:2_000]
            options = public.get("options") if isinstance(public.get("options"), list) else []
            answer_result = await self._request_user_input(
                state,
                prompt=stem,
                questions=[{"id": question_id or "mastery_answer", "question": stem, "options": [str(item)[:400] for item in options[:8]]}],
            )
            answer_status = str(answer_result.get("status") or "expired")
            result = {
                **result,
                "modelResult": {
                    "ok": answer_status == "answered",
                    "questionId": question_id,
                    "answer": str(answer_result.get("text") or "")[:2_000],
                    "answers": answer_result.get("answers", []),
                    "expectedAnswerIncluded": False,
                },
            }
        model_result = result.get("modelResult") if isinstance(result.get("modelResult"), dict) else {}
        safe_summary: dict[str, Any] = {
            "requestId": request_id,
            "toolName": tool_name,
            "status": result.get("status"),
            "source": "agent_loop",
            "resultKeys": sorted(str(key) for key in model_result.keys())[:24],
        }
        if isinstance(model_result.get("rawRecordsIncluded"), bool):
            safe_summary["rawRecordsIncluded"] = model_result["rawRecordsIncluded"]
        # Keep bounded gate diagnostics visible to the host UI/evals without
        # exporting the full model result or any student record content.
        for key in ("reason", "knowledgeType"):
            value = model_result.get(key)
            if isinstance(value, (str, int, float, bool)):
                safe_summary[key] = str(value)[:80]
        analytics = model_result.get("analytics")
        if isinstance(analytics, dict):
            window = analytics.get("window")
            evidence = analytics.get("evidence")
            if isinstance(window, dict):
                safe_summary["learningAnalytics"] = {
                    "schemaVersion": str(analytics.get("schemaVersion") or "omni.learning.analytics.v1")[:80],
                    "startDate": str(window.get("startDate") or "")[:10],
                    "endDate": str(window.get("endDate") or "")[:10],
                    "subject": str(window.get("subject") or "")[:80],
                    "sourceRecordIds": [str(item)[:160] for item in (evidence.get("sourceRecordIds") if isinstance(evidence, dict) and isinstance(evidence.get("sourceRecordIds"), list) else [])[:100]],
                }
        # The full policy is intentionally kept out of the event stream.  These
        # bounded fields let the renderer and smoke tests prove that the host
        # returned a real, deterministic mastery decision without exposing
        # student records or the complete due-review queue.
        policy = model_result.get("policy")
        if isinstance(policy, dict):
            version = policy.get("version")
            if version is not None:
                safe_summary["policyVersion"] = str(version)[:80]
            next_policy = policy.get("next")
            if isinstance(next_policy, dict):
                action = next_policy.get("action")
                point_id = next_policy.get("knowledgePointId")
                if action is not None:
                    safe_summary["nextAction"] = str(action)[:40]
                if point_id is not None:
                    safe_summary["nextKnowledgePointId"] = str(point_id)[:120]
            due_reviews = policy.get("dueReviews")
            if isinstance(due_reviews, list):
                safe_summary["dueReviewCount"] = min(len(due_reviews), 20)
        self._event(state, "tool_result", "running", "宿主工具结果已返回", "已收到 Electron main 的审核结果。", safe_summary)
        return result

    async def _request_model(self, state: TurnState, *, capability: str, kwargs: dict[str, Any]) -> dict[str, Any]:
        """Ask Electron main for one provider completion without exporting keys."""
        messages = kwargs.get("messages") if isinstance(kwargs.get("messages"), list) else []
        tools = kwargs.get("tools") if isinstance(kwargs.get("tools"), list) else []
        try:
            safe_messages = json.loads(json.dumps(messages, ensure_ascii=False))[:64]
            safe_tools = json.loads(json.dumps(tools, ensure_ascii=False))[:32]
        except (TypeError, ValueError) as exc:
            raise RuntimeError(f"model request is not JSON serializable: {exc}") from exc
        request_id = f"model_{state.turn_id}_{state.sequence + 1}"
        waiter: Queue[dict[str, Any]] = Queue(maxsize=1)
        with self._model_results_lock:
            self._model_results[request_id] = waiter
        self._event(state, "stage", "awaiting_host", "等待宿主模型", "模型凭证保留在 Electron main，sidecar 只请求本轮 completion。", {"requestId": request_id, "provider": "host_model"})
        self._write({"type": "model_request", "request": {
            "schemaVersion": "xiazhi.model.request.v1",
            "requestId": request_id,
            "turnId": state.turn_id,
            "capability": capability,
            "model": str(kwargs.get("model") or ""),
            "messages": safe_messages,
            "tools": safe_tools,
            "temperature": kwargs.get("temperature"),
            "maxTokens": kwargs.get("max_tokens"),
        }})
        try:
            result = await asyncio.to_thread(waiter.get, True, 45)
        except (Empty, TimeoutError):
            result = {"schemaVersion": "xiazhi.model.result.v1", "requestId": request_id, "turnId": state.turn_id, "status": "failed", "error": {"code": "MODEL_PROXY_TIMEOUT", "message": "宿主模型请求超时。", "retryable": True}}
        finally:
            with self._model_results_lock:
                self._model_results.pop(request_id, None)
        self._event(state, "stage", "running" if result.get("status") == "succeeded" else "failed", "宿主模型结果", "宿主模型已返回本轮 completion。" if result.get("status") == "succeeded" else "宿主模型未返回可用 completion。", {"requestId": request_id, "provider": "host_model", "status": result.get("status")})
        if result.get("status") != "succeeded":
            error = result.get("error") if isinstance(result.get("error"), dict) else {}
            raise RuntimeError(str(error.get("message") or "宿主模型请求失败。"))
        response = result.get("response")
        if not isinstance(response, dict):
            raise RuntimeError("宿主模型响应缺少 response object。")
        choices = response.get("choices") if isinstance(response.get("choices"), list) else []
        first_choice = choices[0] if choices and isinstance(choices[0], dict) else {}
        first_message = first_choice.get("message") if isinstance(first_choice.get("message"), dict) else {}
        recovery = response.get("recovery") if isinstance(response.get("recovery"), dict) else {}
        self._event(
            state,
            "stage",
            "running",
            "宿主模型 JSON 状态",
            "已检查模型终止原因与 JSON content 可用性。",
            {
                "provider": "host_model",
                "finishReason": str(first_choice.get("finish_reason") or "unknown")[:80],
                "contentPresent": bool(str(first_message.get("content") or "").strip()),
                "jsonRecoveryAttempted": bool(recovery.get("attempted")),
                "jsonRecoveryReason": str(recovery.get("reason") or "")[:80],
            },
        )
        return response

    async def _request_user_input(
        self,
        state: TurnState,
        *,
        prompt: str,
        questions: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Pause one AgentLoop tool step until Electron submits an answer."""
        request_id = f"input_{state.turn_id}_{state.sequence + 1}"
        waiter: Queue[dict[str, Any]] = Queue(maxsize=1)
        with self._user_input_results_lock:
            self._user_input_results[request_id] = waiter
            self._user_input_turns[request_id] = state.turn_id
        safe_questions: list[dict[str, Any]] = []
        for item in (questions or [])[:8]:
            if not isinstance(item, dict):
                continue
            question = str(item.get("question") or "").strip()[:2_000]
            if not question:
                continue
            options = item.get("options") if isinstance(item.get("options"), list) else []
            safe_questions.append({
                "id": str(item.get("id") or f"question_{len(safe_questions) + 1}")[:120],
                "question": question,
                "options": [str(option)[:200] for option in options[:8]],
            })
        self._event(
            state,
            "stage",
            "awaiting_host",
            "等待老师输入",
            str(prompt or "请补充必要信息。")[:2_000],
            {"requestId": request_id, "kind": "user_input", "questionCount": len(safe_questions)},
        )
        self._write({"type": "user_input_request", "request": {
            "schemaVersion": "xiazhi.user_input.request.v1",
            "requestId": request_id,
            "turnId": state.turn_id,
            "prompt": str(prompt or "请补充必要信息。")[:2_000],
            "questions": safe_questions,
            "expiresAt": "",
        }})
        try:
            result = await asyncio.to_thread(waiter.get, True, 120)
        except (Empty, TimeoutError):
            result = {
                "schemaVersion": "xiazhi.user_input.result.v1",
                "requestId": request_id,
                "turnId": state.turn_id,
                "status": "expired",
                "text": "",
            }
        finally:
            with self._user_input_results_lock:
                self._user_input_results.pop(request_id, None)
                self._user_input_turns.pop(request_id, None)
        status = str(result.get("status") or "expired")
        self._event(
            state,
            "stage",
            "running" if status == "answered" else "failed",
            "老师输入已返回" if status == "answered" else "老师输入未返回",
            "已将老师输入交回 DeepTutor AgentLoop。" if status == "answered" else "等待老师输入超时或被取消。",
            {"requestId": request_id, "kind": "user_input", "status": status},
        )
        return result

    async def _run_deeptutor_loop(self, state: TurnState, params: dict[str, Any]) -> None:
        from deeptutor.agents.chat.agent_loop import AgentLoop
        from deeptutor.core.context import UnifiedContext
        from deeptutor.core.stream_bus import StreamBus

        prompt = str(params["prompt"])
        context_payload = params.get("context") or {}
        language = str(context_payload.get("language") or "zh")
        capability_name = str(params.get("capability") or "chat")
        use_host_model = context_payload.get("modelProxy") == "deepseek"
        use_console_agent_loop = context_payload.get("executionProfile") == "omni_console"
        system_prompt = str(context_payload.get("systemPrompt") or "")[:20_000]
        config_overrides = context_payload.get("configOverrides")
        if not isinstance(config_overrides, dict):
            config_overrides = context_payload.get("config_overrides")
        if not isinstance(config_overrides, dict):
            config_overrides = {}
        knowledge_bases = context_payload.get("knowledgeBases")
        if not isinstance(knowledge_bases, list):
            knowledge_bases = []
        enabled_tools = context_payload.get("enabledTools")
        if not isinstance(enabled_tools, list):
            enabled_tools = []
        context = UnifiedContext(
            session_id=str(context_payload.get("sessionId") or ""),
            user_message=prompt,
            language=language,
            active_capability=capability_name,
            knowledge_bases=[str(item)[:120] for item in knowledge_bases[:16]],
            enabled_tools=[str(item)[:120] for item in enabled_tools[:32]],
            config_overrides=config_overrides,
            metadata={"turn_id": state.turn_id},
        )
        stream = StreamBus()

        host_request = context_payload.get("hostToolRequest")
        auto_tool_request = context_payload.get("hostToolAuto") if context_payload.get("dryRun") is True else None
        if isinstance(host_request, dict):
            host_result = await self._request_host_tool(
                state,
                capability=capability_name,
                prompt=prompt,
                tool_name=str(host_request.get("toolName") or ""),
                arguments=host_request.get("arguments") if isinstance(host_request.get("arguments"), dict) else {},
            )
            context.user_message = f"{prompt}\n\n[HostToolProxy observation]\n{json.dumps(host_result, ensure_ascii=False)[:4000]}"

        async def produce() -> None:
            self._event(state, "stage", "running", "DeepTutor 能力开始执行", f"已启动 {capability_name} 上游能力。", {"capability": capability_name, "engine": "deeptutor-agent-loop" if use_console_agent_loop or capability_name == "chat" else "deeptutor-capability", "executionProfile": "omni_console" if use_console_agent_loop else "native_capability"})
            mastery_snapshot = context_payload.get("masterySnapshot")
            if capability_name == "mastery_path" and isinstance(mastery_snapshot, dict):
                try:
                    from deeptutor.learning.mastery import compute_mastery
                    from deeptutor.learning.models import KnowledgePoint, KnowledgeType, LearningModule, LearningProgress, QuizAttempt
                    from deeptutor.learning.policy import map_summary, next_objective

                    modules = [
                        LearningModule(
                            id=str(module.get("id") or "module_general"),
                            name=str(module.get("name") or "未分类"),
                            order=int(module.get("order") or 0),
                            knowledge_points=[
                                KnowledgePoint(
                                    id=str(point.get("id") or "kp_unknown"),
                                    name=str(point.get("name") or "未命名知识点"),
                                    type=KnowledgeType(str(point.get("type") or "procedure")),
                                    module_id=str(point.get("module_id") or module.get("id") or "module_general"),
                                )
                                for point in (module.get("knowledge_points") if isinstance(module.get("knowledge_points"), list) else [])[:80]
                            ],
                        )
                        for module in (mastery_snapshot.get("modules") if isinstance(mastery_snapshot.get("modules"), list) else [])[:32]
                        if isinstance(module, dict)
                    ]
                    attempts = [
                        QuizAttempt(
                            question_id=str(attempt.get("questionId") or "attempt_unknown"),
                            knowledge_point_id=str(attempt.get("knowledgePointId") or "kp_unknown"),
                            module_id=str(attempt.get("moduleId") or ""),
                            is_correct=bool(attempt.get("isCorrect")),
                            timestamp=float(attempt.get("timestamp") or 0),
                        )
                        for attempt in (mastery_snapshot.get("attempts") if isinstance(mastery_snapshot.get("attempts"), list) else [])[:500]
                        if isinstance(attempt, dict)
                    ]
                    progress = LearningProgress(book_id=str(mastery_snapshot.get("bookId") or "omni"), modules=modules, quiz_attempts=attempts)
                    for point in [point for module in modules for point in module.knowledge_points]:
                        correctness = [attempt.is_correct for attempt in attempts if attempt.knowledge_point_id == point.id]
                        if correctness:
                            progress.mastery_levels[point.id] = compute_mastery(correctness)
                    next_step = next_objective(progress)
                    summary = {
                        "next": next_step.to_dict(),
                        "map": map_summary(progress),
                        "evidence": mastery_snapshot.get("evidence", {}),
                        "source": "omni_edu_learning_records",
                        "policy": "deeptutor.learning.policy.v1",
                    }
                    context.metadata["omni_mastery_snapshot"] = summary
                    self._event(state, "stage", "running", "Mastery 学情评估", "已基于本地学习记录计算掌握度门槛。", {"capability": capability_name, "source": "omni_edu_learning_records", "evidence": summary["evidence"]})
                    if context_payload.get("dryRun") is True:
                        self._event(state, "result", "succeeded", "Mastery Path 教师计划", "已形成可由教师审核的下一步学习计划。", {"engine": "deeptutor-capability", "capability": capability_name, "upstreamCommit": UPSTREAM_COMMIT, "mastery": summary})
                        await stream.close()
                        return
                except Exception as exc:
                    state.failed = True
                    await stream.error(f"Mastery snapshot failed: {str(exc)[:800]}", source=capability_name, metadata={"turn_terminal": True, "status": "failed", "capability": capability_name})
                    await stream.close()
                    return

            if capability_name in {"deep_solve", "mastery_path"} and not use_console_agent_loop:
                # These upstream capabilities intentionally construct the
                # shared AgenticChatPipeline themselves.  Swap only the model
                # client at the adapter seam; the capability and AgentLoop
                # source remain the pinned DeepTutor implementation.
                from deeptutor.agents.chat.agentic_pipeline import AgenticChatPipeline
                if capability_name == "deep_solve":
                    from deeptutor.capabilities.solve import capability as capability_module
                    capability_cls = capability_module.DeepSolveCapability
                else:
                    from deeptutor.capabilities.mastery import capability as capability_module
                    capability_cls = capability_module.MasteryPathCapability

                class HostModelPipeline(AgenticChatPipeline):
                    def _build_openai_client(self) -> Any:
                        if use_host_model:
                            return _HostModelClient(self_bridge, state, capability=capability_name)
                        return _FakeClient(f"小智已通过 DeepTutor {capability_name} Capability + AgentLoop 完成本轮 dry-run：{prompt[:160]}")

                self_bridge = self
                with self._capability_pipeline_patch_lock:
                    original_pipeline = capability_module.AgenticChatPipeline
                    capability_module.AgenticChatPipeline = HostModelPipeline
                    try:
                        await capability_cls().run(context, stream)
                    finally:
                        capability_module.AgenticChatPipeline = original_pipeline
                await stream.close()
                return

            if capability_name in {"deep_question", "deep_research", "visualize"} and not use_console_agent_loop:
                # These capabilities use older module-level provider seams.
                # Patch only those seams while the pinned upstream capability
                # runs, preserving the host-owned credential boundary.
                self._event(state, "stage", "running", "加载 DeepTutor 能力适配", "正在加载上游能力模块。", {"capability": capability_name})
                from deeptutor.agents import base_agent as base_agent_module
                self._event(state, "stage", "running", "基础 Agent 模块已加载", "正在加载具体能力模块。", {"capability": capability_name})
                originals: list[tuple[Any, str, Any]] = [(base_agent_module, "llm_complete", base_agent_module.llm_complete)]
                capability_module: Any
                if capability_name == "deep_question":
                    from deeptutor.agents.question import pipeline as capability_pipeline
                    self._event(state, "stage", "running", "题目 pipeline 已加载", "正在加载题目能力入口。", {"capability": capability_name})
                    from deeptutor.agents.question import capability as capability_module
                    self._event(state, "stage", "running", "题目 capability 已加载", "题目能力入口已就绪。", {"capability": capability_name})
                elif capability_name == "deep_research":
                    from deeptutor.agents.research import pipeline as capability_pipeline
                    self._event(state, "stage", "running", "研究 pipeline 已加载", "正在加载研究能力入口。", {"capability": capability_name})
                    from deeptutor.agents.research import capability as capability_module
                    self._event(state, "stage", "running", "研究 capability 已加载", "研究能力入口已就绪。", {"capability": capability_name})
                else:
                    capability_pipeline = None
                    from deeptutor.agents.visualize import capability as capability_module

                self._event(state, "stage", "running", "解析能力入口", "正在解析上游 capability 类。", {"capability": capability_name})
                capability_cls = getattr(
                    capability_module,
                    {
                        "deep_question": "DeepQuestionCapability",
                        "deep_research": "DeepResearchCapability",
                        "visualize": "VisualizeCapability",
                    }[capability_name],
                )
                self._event(state, "stage", "running", "能力入口已解析", "上游 capability 类已解析。", {"capability": capability_name})
                self._event(state, "stage", "running", "准备模型边界适配", "上游能力模块已加载，正在绑定宿主模型边界。", {"capability": capability_name})
                if capability_pipeline is not None:
                    originals.append((capability_pipeline, "build_openai_client", capability_pipeline.build_openai_client))
                with self._capability_pipeline_patch_lock:
                    self._event(state, "stage", "running", "进入能力执行临界区", "正在执行上游能力的原生 pipeline。", {"capability": capability_name})
                    try:
                        if use_host_model:
                            client = _HostModelClient(self, state, capability=capability_name)
                            if capability_pipeline is not None:
                                capability_pipeline.build_openai_client = lambda _config: client
                            base_agent_module.llm_complete = _HostCompletionService(self, state, capability=capability_name)
                        else:
                            client = _CapabilityFakeClient(capability_name)
                            if capability_pipeline is not None:
                                capability_pipeline.build_openai_client = lambda _config: client
                            # Visualize agents inherit BaseAgent and call the
                            # service seam; the deterministic client is exposed as
                            # a small completion function for dry-run only.
                            async def _fake_complete(*, prompt: str, system_prompt: str, **_: Any) -> str:
                                response = await client.chat.completions.create(messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}])
                                chunks = [chunk async for chunk in response]
                                return "".join(str(getattr(getattr(chunk.choices[0], "delta", None), "content", "") or "") for chunk in chunks)
                            base_agent_module.llm_complete = _fake_complete
                        try:
                            await capability_cls().run(context, stream)
                        except Exception as exc:
                            state.failed = True
                            await stream.error(f"{type(exc).__name__}: {str(exc)[:800]}", source=capability_name, metadata={"turn_terminal": True, "status": "failed", "capability": capability_name})
                    finally:
                        for module, attribute, original in reversed(originals):
                            setattr(module, attribute, original)
                await stream.close()
                return

            tool_lookup = None
            enabled_tools: list[str] = []
            client: Any = _HostModelClient(self, state, capability=capability_name) if use_host_model else _FakeClient(f"小智已通过 DeepTutor AgentLoop 完成本轮 dry-run：{prompt[:160]}")
            if isinstance(auto_tool_request, dict):
                tool_name = str(auto_tool_request.get("toolName") or "resolve_student_reference")
                arguments = auto_tool_request.get("arguments") if isinstance(auto_tool_request.get("arguments"), dict) else {"studentName": ""}
                remote_tool = _HostProxyTool(self, state, capability=capability_name, prompt=prompt, tool_name=tool_name)
                tool_lookup = _SingleToolLookup(remote_tool)
                enabled_tools = [tool_name]
                client = _AutoToolClient(tool_name=tool_name, arguments=arguments, final_text=f"已根据宿主工具结果完成核对：{prompt[:120]}")
            elif isinstance(context_payload.get("hostTools"), list):
                remote_tools: list[_HostProxyTool] = []
                for raw in context_payload.get("hostTools", [])[:64]:
                    item = raw if isinstance(raw, dict) else {}
                    function = item.get("function") if isinstance(item.get("function"), dict) else item
                    name = str(function.get("name") or "").strip()
                    if not name or not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", name):
                        continue
                    parameters = function.get("parameters") if isinstance(function.get("parameters"), dict) else {"type": "object", "properties": {}, "additionalProperties": False}
                    remote_tools.append(_HostProxyTool(
                        self,
                        state,
                        capability=capability_name,
                        prompt=prompt,
                        tool_name=name,
                        description=str(function.get("description") or "通过 Omni-Edu 宿主审核后执行的只读工具。")[:500],
                        parameters=parameters,
                    ))
                if remote_tools:
                    raw_progressive_names = context_payload.get("progressiveToolNames")
                    progressive_names = [str(name) for name in raw_progressive_names[:16]] if isinstance(raw_progressive_names, list) else None
                    tool_lookup = _SingleToolLookup(remote_tools, initial_names=progressive_names)
                    enabled_tools = tool_lookup.list_tools()
            tool_schemas = tool_lookup.build_openai_schemas(enabled_tools) if tool_lookup else None
            pipeline = _DryRunPipeline(
                prompt,
                language,
                tool_lookup=tool_lookup,
                system_prompt=system_prompt,
                tool_schemas=tool_schemas,
                enabled_tools=enabled_tools,
            )
            loop = AgentLoop(
                pipeline=pipeline,
                context=context,
                stream=stream,
                client=client,
                enabled_tools=enabled_tools,
                tool_schemas=tool_schemas,
            )
            try:
                await loop.run()
            except Exception as exc:
                state.failed = True
                await stream.error(str(exc), source="deeptutor", metadata={"turn_terminal": True, "status": "failed"})
            finally:
                await stream.close()

        task = asyncio.create_task(produce())
        async for event in stream.subscribe():
            if event.type.value == "thinking":
                # Never expose raw hidden reasoning in the public event.
                self._event(state, "reasoning", "running", "处理中", "已完成一个内部推理片段。", {"traceOnly": True})
            elif event.type.value == "content":
                self._event(state, "answer", "running", "小智回复", event.content, {"source": event.source, "stage": event.stage})
            elif event.type.value == "tool_call":
                self._event(state, "tool", "running", "调用工具", event.content, {"argsPresent": bool(event.metadata.get("args"))})
            elif event.type.value == "tool_result":
                self._event(state, "observation", "running", "工具结果已返回", "已收到工具观察结果。", {"tool": event.metadata.get("tool")})
            elif event.type.value == "result":
                result_payload = event.metadata.get("response")
                result = result_payload if isinstance(result_payload, str) else ""
                if isinstance(event.metadata, dict):
                    result_keys = [str(key)[:80] for key in event.metadata.keys() if str(key) not in {"response", "raw"}][:32]
                    public_summary = {
                        # Solve/mastery are DeepTutor capabilities built on the
                        # shared AgentLoop pipeline; retain that public engine
                        # identity for the existing bridge contract. The
                        # older question/research/visualize adapters expose
                        # their capability engine explicitly.
                        "engine": "deeptutor-capability" if capability_name in {"deep_question", "deep_research", "visualize"} and not use_console_agent_loop else "deeptutor-agent-loop",
                        "capability": capability_name,
                        "executionProfile": "omni_console" if use_console_agent_loop else "native_capability",
                        "upstreamCommit": UPSTREAM_COMMIT,
                        "resultKeys": result_keys,
                    }
                    for key in ("summary", "metadata", "render_type", "code", "analysis", "review", "research_config"):
                        if key in event.metadata:
                            value = event.metadata.get(key)
                            if isinstance(value, (str, int, float, bool)):
                                public_summary[key] = value
                            elif isinstance(value, dict):
                                public_summary[key] = {str(k): value[k] for k in list(value)[:24]}
                            elif isinstance(value, list):
                                public_summary[key] = value[:24]
                else:
                    public_summary = {"engine": "deeptutor-agent-loop", "capability": capability_name, "upstreamCommit": UPSTREAM_COMMIT}
                # Preserve the complete bounded contract payload. The former
                # 20k slice could turn valid provider JSON into invalid JSON
                # before Electron's xiazhi.reply.v2 parser received it.
                self._event(
                    state,
                    "result",
                    "succeeded",
                    "DeepTutor AgentLoop 结果",
                    result[:FINAL_RESULT_DETAIL_LIMIT],
                    public_summary,
                )
            elif event.type.value == "error":
                self._event(state, "error", "failed", "DeepTutor AgentLoop 失败", event.content, {"turn_terminal": True})
        await task
        if not state.terminal:
            state.terminal = True
            self._event(
                state,
                "done",
                "failed" if state.failed else "succeeded",
                "sidecar 运行结束",
                "DeepTutor AgentLoop 本轮失败。" if state.failed else "真实 DeepTutor AgentLoop 已完成本轮。",
                {"terminationReason": "agent_loop_failed" if state.failed else "agent_loop_complete", "upstreamCommit": UPSTREAM_COMMIT},
            )

    def _start_thread(self, state: TurnState, params: dict[str, Any]) -> None:
        def runner() -> None:
            try:
                asyncio.run(self._run_deeptutor_loop(state, params))
            except BudgetExceeded:
                # The budget event was emitted by _event; do not emit a second
                # generic runtime failure or overwrite its terminal reason.
                return
            except Exception as exc:
                state.terminal = True
                state.failed = True
                self._event(state, "done", "failed", "sidecar 运行失败", "DeepTutor 运行时异常。", {"code": "DEEPTUTOR_RUNTIME_ERROR", "detail": str(exc)[:500]})

        thread = threading.Thread(target=runner, name=f"deeptutor-{state.turn_id}", daemon=True)
        self._threads.add(thread)
        thread.start()

    def handle(self, request: Any) -> None:
        if not isinstance(request, dict):
            self._write({"type": "error", "error": {"code": "INVALID_FRAME", "message": "request must be an object"}})
            return
        if request.get("type") == "user_input_result":
            result = request.get("result")
            if (
                not isinstance(result, dict)
                or result.get("schemaVersion") != "xiazhi.user_input.result.v1"
                or not isinstance(result.get("requestId"), str)
                or len(result["requestId"]) > 120
                or result.get("status") not in {"answered", "cancelled", "expired"}
                or not isinstance(result.get("turnId"), str)
                or len(result["turnId"]) > 120
                or not isinstance(result.get("text", ""), str)
                or len(result.get("text", "")) > 8_000
                or not isinstance(result.get("answers", []), list)
                or len(result.get("answers", [])) > 16
            ):
                self._write({"type": "error", "error": {"code": "INVALID_USER_INPUT_RESULT", "message": "user input result is invalid"}})
                return
            if any(
                not isinstance(answer, dict)
                or not isinstance(answer.get("id"), str)
                or len(answer.get("id", "")) > 120
                or not isinstance(answer.get("value", ""), str)
                or len(answer.get("value", "")) > 2_000
                for answer in result.get("answers", [])
            ):
                self._write({"type": "error", "error": {"code": "INVALID_USER_INPUT_RESULT", "message": "user input answers are invalid"}})
                return
            with self._user_input_results_lock:
                waiter = self._user_input_results.get(str(result["requestId"]))
                expected_turn_id = self._user_input_turns.get(str(result["requestId"]))
            if waiter is not None and expected_turn_id != result.get("turnId"):
                self._write({"type": "error", "error": {"code": "USER_INPUT_TURN_MISMATCH", "message": "user input result does not belong to the waiting turn"}})
                return
            if waiter is not None:
                try:
                    waiter.put_nowait(result)
                except Exception:
                    pass
            return
        request_id = request.get("id")
        method = request.get("method")
        params = request.get("params", {})
        if not isinstance(request_id, str) or not request_id or len(request_id) > 120:
            self._write({"type": "error", "error": {"code": "INVALID_REQUEST_ID", "message": "request id is required"}})
            return
        if not isinstance(params, dict):
            self._response(request_id, code="INVALID_PARAMS", message="params must be an object")
            return
        if method == "handshake":
            self._response(request_id, result={"manifest": self._manifest()})
            return
        if method == "start_turn":
            turn_id, validation_error = self._validate_turn(params)
            if validation_error or turn_id is None:
                self._response(request_id, code="INVALID_TURN", message=validation_error or "invalid turn")
                return
            if turn_id in self._turns and not self._turns[turn_id].terminal:
                self._response(request_id, code="TURN_ALREADY_RUNNING", message="turn is already running")
                return
            budgets = params.get("budgets") if isinstance(params.get("budgets"), dict) else {}
            max_events = int(budgets.get("maxEvents", 32))
            state = TurnState(turn_id=turn_id, max_events=max_events, cancel_event=threading.Event())
            self._turns[turn_id] = state
            self._response(request_id, result={"accepted": True, "turnId": turn_id, "engine": "deeptutor-agent-loop"})
            if params.get("context", {}).get("hold") is True:
                self._event(state, "stage", "running", "sidecar 已接收任务", "保留 hold 测试语义，等待宿主取消。", {"hold": True})
                return
            self._start_thread(state, params)
            return
        if method == "cancel_turn":
            turn_id = params.get("turnId")
            state = self._turns.get(turn_id) if isinstance(turn_id, str) else None
            if state is None:
                self._response(request_id, code="TURN_NOT_FOUND", message="turn does not exist")
                return
            if state.terminal:
                self._response(request_id, result={"turnId": turn_id, "alreadyTerminal": True})
                return
            if state.cancel_event is not None:
                state.cancel_event.set()
            state.terminal = True
            self._response(request_id, result={"turnId": turn_id, "cancelled": True})
            self._event(state, "done", "cancelled", "sidecar 已取消", "本轮由宿主取消。", {"terminationReason": "cancelled"})
            return
        if method == "host_tool_result":
            result = request.get("result")
            if not isinstance(result, dict) or not isinstance(result.get("requestId"), str):
                self._write({"type": "error", "error": {"code": "INVALID_HOST_TOOL_RESULT", "message": "host tool result is invalid"}})
                return
            with self._host_results_lock:
                waiter = self._host_results.get(str(result["requestId"]))
            if waiter is not None:
                try:
                    waiter.put_nowait(result)
                except Exception:
                    pass
            return
        if method == "model_result":
            result = request.get("result")
            if not isinstance(result, dict) or not isinstance(result.get("requestId"), str):
                self._write({"type": "error", "error": {"code": "INVALID_MODEL_RESULT", "message": "model result is invalid"}})
                return
            with self._model_results_lock:
                waiter = self._model_results.get(str(result["requestId"]))
            if waiter is not None:
                try:
                    waiter.put_nowait(result)
                except Exception:
                    pass
            return
        if method == "shutdown":
            self._response(request_id, result={"stopping": True})
            self._running = False
            return
        self._response(request_id, code="METHOD_NOT_FOUND", message=f"unsupported bridge method: {method}")

    def run(self) -> None:
        Bridge._stdout_lock = self._write_lock
        for raw_line in sys.stdin.buffer:
            if not self._running:
                break
            if len(raw_line) > MAX_FRAME_BYTES:
                self._write({"type": "error", "error": {"code": "FRAME_TOO_LARGE", "message": "NDJSON frame exceeds 1MB"}})
                continue
            try:
                request = json.loads(raw_line.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                self._write({"type": "error", "error": {"code": "INVALID_JSON", "message": "frame is not valid UTF-8 JSON"}})
                continue
            try:
                if isinstance(request, dict) and request.get("type") == "host_tool_result":
                    self.handle({"id": f"host_result_{request.get('result', {}).get('requestId', 'unknown')}", "method": "host_tool_result", "params": {}, "result": request.get("result")})
                elif isinstance(request, dict) and request.get("type") == "model_result":
                    self.handle({"id": f"model_result_{request.get('result', {}).get('requestId', 'unknown')}", "method": "model_result", "params": {}, "result": request.get("result")})
                else:
                    self.handle(request)
            except Exception:
                self._write({"type": "error", "error": {"code": "INTERNAL_ERROR", "message": "sidecar internal error"}})
        # When the host closes stdin after issuing a turn, keep the process
        # alive until background AgentLoop threads have flushed their events.
        for thread in list(self._threads):
            thread.join(timeout=120)


def main() -> None:
    Bridge().run()
