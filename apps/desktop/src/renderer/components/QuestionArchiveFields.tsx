import type { ArchiveFields } from "../../shared/question-archive";

/** Shared fields for the existing bank editor and source-structure correction. */
export function QuestionArchiveFields({
  fields,
  onChange,
  disabled = false,
  difficultyChosen,
  onDifficultyChosen,
  prefix = "question-archive",
}: {
  fields: ArchiveFields;
  onChange: (fields: ArchiveFields) => void;
  disabled?: boolean;
  difficultyChosen: boolean;
  onDifficultyChosen: () => void;
  prefix?: string;
}) {
  return (
    <>
      {(
        [
          ["subject", "学科"],
          ["grade", "年级"],
          ["knowledgePoint", "知识点"],
          ["questionType", "题型"],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            disabled={disabled}
            value={fields[key]}
            maxLength={128}
            onChange={(event) =>
              onChange({ ...fields, [key]: event.target.value })
            }
            data-testid={prefix + "-" + key}
          />
        </label>
      ))}
      <label>
        难度
        <select
          disabled={disabled}
          value={difficultyChosen ? fields.difficulty : ""}
          onChange={(event) => {
            onChange({
              ...fields,
              difficulty: event.target.value as ArchiveFields["difficulty"],
            });
            onDifficultyChosen();
          }}
          data-testid={prefix + "-difficulty"}
        >
          <option value="" disabled>
            请选择难度
          </option>
          <option value="easy">基础</option>
          <option value="medium">中等</option>
          <option value="hard">困难</option>
        </select>
      </label>
      {(
        [
          ["stem", "题干"],
          ["answer", "答案"],
          ["analysis", "解析"],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          {label}
          <textarea
            disabled={disabled}
            value={fields[key]}
            maxLength={12000}
            onChange={(event) =>
              onChange({ ...fields, [key]: event.target.value })
            }
            data-testid={prefix + "-" + key}
          />
        </label>
      ))}
    </>
  );
}
