import { useEffect, useState } from "react";
import { Button, Label, SearchField } from "@heroui/react";
import { BookOpen, Plus } from "lucide-react";
import type {
  QuestionNotebookEntry,
  QuestionSearchFilters,
} from "../../../shared/contracts";
import { questionFacts } from "../../../shared/question-facts";
import { PaperQuestionContent } from "./PaperQuestionContent";
import { PaperSelect } from "./PaperSelect";
import styles from "../../ui-system/paper-studio/paper-library-browser.module.css";

type Row = { question: QuestionNotebookEntry; version: string };
const pageSize = 12;

/** Read the real canonical library before a teacher explicitly creates a basket. */
export function PaperLibraryBrowser({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [knowledgePoint, setKnowledgePoint] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [difficulty, setDifficulty] =
    useState<QuestionSearchFilters["difficulty"]>();
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const api = window.omniEdu;
          if (!api) throw new Error("unavailable");
          const result = await api.listQuestionNotebook({
            query,
            knowledgePoint,
            questionType,
            difficulty,
            offset,
            limit: pageSize,
          });
          const items = await Promise.all(
            result.items.map(async (question) => {
              const bytes = await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(
                  JSON.stringify(questionFacts(question)),
                ),
              );
              const version = Array.from(new Uint8Array(bytes), (byte) =>
                byte.toString(16).padStart(2, "0"),
              ).join("");
              return { question, version };
            }),
          );
          if (live) {
            setRows(items);
            setTotal(result.total);
          }
        } catch {
          if (live) setError("题目读取未完成，请重试。");
        } finally {
          if (live) setLoading(false);
        }
      })();
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, knowledgePoint, questionType, difficulty, offset, refresh]);

  return (
    <section
      className={styles.workspace}
      data-testid="paper-library-browser"
      aria-label="题库浏览"
    >
      <aside className={styles.filters} aria-label="知识点与分类">
        <h2>知识点与分类</h2>
        <SearchField
          value={knowledgePoint}
          isDisabled={disabled}
          onChange={(value) => {
            setKnowledgePoint(value);
            setOffset(0);
          }}
        >
          <Label>知识点</Label>
          <SearchField.Group>
            <SearchField.Input data-testid="paper-library-knowledge-point" />
            <SearchField.ClearButton aria-label="清除知识点" />
          </SearchField.Group>
        </SearchField>
        <p>浏览已保存题目，核对题干、原图和来源。</p>
      </aside>
      <div className={styles.main}>
        <div className={styles.toolbar}>
          <SearchField
            value={query}
            isDisabled={disabled}
            aria-label="搜索题库"
            onChange={(value) => {
              setQuery(value);
              setOffset(0);
            }}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                data-testid="paper-library-query"
                placeholder="搜索题干、知识点或标签"
              />
              <SearchField.ClearButton aria-label="清除题目搜索" />
            </SearchField.Group>
          </SearchField>
          <div className={styles.filterRow}>
            <PaperSelect
              label="题型"
              value={questionType}
              disabled={disabled}
              testId="paper-library-type"
              options={[
                { id: "", label: "全部题型" },
                ...["选择题", "填空题", "解答题"].map((id) => ({
                  id,
                  label: id,
                })),
              ]}
              onChange={(value) => {
                setQuestionType(value);
                setOffset(0);
              }}
            />
            <PaperSelect
              label="难度"
              value={difficulty || ""}
              disabled={disabled}
              testId="paper-library-difficulty"
              options={[
                { id: "", label: "全部难度" },
                { id: "easy", label: "基础" },
                { id: "medium", label: "中等" },
                { id: "hard", label: "较难" },
              ]}
              onChange={(value) => {
                setDifficulty(
                  value === "easy" || value === "medium" || value === "hard"
                    ? value
                    : undefined,
                );
                setOffset(0);
              }}
            />
            <Button
              variant="ghost"
              isDisabled={disabled}
              onPress={() => {
                setQuery("");
                setKnowledgePoint("");
                setQuestionType("");
                setDifficulty(undefined);
                setOffset(0);
              }}
            >
              重置
            </Button>
            <span className={styles.count}>
              {loading
                ? "正在读取题目…"
                : error
                  ? "读取失败"
                  : `共 ${total} 道题`}
            </span>
          </div>
        </div>
        <div
          className={styles.questions}
          data-testid="paper-library-results"
          aria-busy={loading}
        >
          {loading && <p role="status">正在读取题目…</p>}
          {error && (
            <div role="alert">
              <p>{error}</p>
              <Button
                variant="secondary"
                onPress={() => setRefresh((value) => value + 1)}
              >
                重新读取
              </Button>
            </div>
          )}
          {!loading && !error && !rows.length && (
            <div className={styles.empty}>
              <BookOpen size={28} aria-hidden="true" />
              <h2>
                {query || knowledgePoint || questionType || difficulty
                  ? "没有匹配的题目"
                  : "题库中还没有题目"}
              </h2>
              <p>可以从资料库整理题目，或在题本中添加题目。</p>
            </div>
          )}
          {!loading &&
            !error &&
            rows.map(({ question, version }) => (
              <article
                className={styles.question}
                key={question.id}
                data-testid="paper-library-question"
                data-question-id={question.id}
              >
                <header>
                  <h3>
                    {question.questionType || "题目"} ·{" "}
                    {question.knowledgePoint || "知识点未标注"}
                  </h3>
                  <span>
                    {question.subject} · {question.grade}
                  </span>
                </header>
                <PaperQuestionContent
                  question={question}
                  contentVersion={version}
                  compactDetails
                />
              </article>
            ))}
        </div>
        {!loading && !error && total > pageSize && (
          <footer className={styles.pagination}>
            <Button
              variant="secondary"
              isDisabled={disabled || offset === 0}
              onPress={() =>
                setOffset((value) => Math.max(0, value - pageSize))
              }
            >
              上一页
            </Button>
            <span>
              {Math.floor(offset / pageSize) + 1} /{" "}
              {Math.ceil(total / pageSize)}
            </span>
            <Button
              variant="secondary"
              isDisabled={disabled || offset + pageSize >= total}
              onPress={() => setOffset((value) => value + pageSize)}
            >
              下一页
            </Button>
          </footer>
        )}
      </div>
      <aside className={styles.basket} aria-label="已选题目">
        <h2>
          已选题目 <span>0</span>
        </h2>
        <div className={styles.empty}>
          <BookOpen size={28} aria-hidden="true" />
          <p>先创建题篮，再加入并核对题目。</p>
        </div>
        <Button
          isDisabled={disabled}
          onPress={onCreate}
          data-testid="paper-library-create"
        >
          <Plus size={16} />
          新建题篮
        </Button>
      </aside>
    </section>
  );
}
