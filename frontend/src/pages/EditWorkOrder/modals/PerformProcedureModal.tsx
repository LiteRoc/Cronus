import React, { useState, useEffect } from "react";
import Modal from "@/components/Modal";
import { TaskResult, WorkOrderProcedure } from "@/types";
import { Button } from "@/components/ui/button";

interface PerformProcedureModalProps {
  procedure: WorkOrderProcedure;
  onSubmitResults: (results: TaskResult[]) => Promise<void>;
  onClose: () => void;
  userId: string;
  userName: string;
}

type DraftTaskResult = {
  taskId?: string;
  type: "pass/fail" | "measurement" | "comment";
  label: string;
  value: boolean | number | string | null;
};

const PerformProcedureModal: React.FC<PerformProcedureModalProps> = ({
  procedure,
  onSubmitResults,
  onClose,
  userName,
}) => {
  const [results, setResults] = useState<DraftTaskResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  console.log("🧪 Incoming procedure:", procedure);
  console.log("🧪 procedure.taskResults:", procedure?.taskResults);


  useEffect(() => {
    if (procedure?.taskResults) {
      setResults(
        procedure.taskResults.map((task) => ({
          taskId: task.taskId,
          type: task.type,
          label: task.label,
          value: "",
        }))
      );
    }
  }, [procedure]);

  const handleResultChange = (index: number, value: string) => {
    setResults((prev) => {
      const updated = [...prev];
      if (updated[index].type === "pass/fail") {
        updated[index].value = value === "pass" ? true : value === "fail" ? false : null;
      } else {
        updated[index].value = value;
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const formatted: TaskResult[] = results
        .filter((r): r is typeof r & { taskId: string } => !!r.taskId)
        .map((r) => ({
          taskId: r.taskId,
          type: r.type,
          label: r.label,
          value: r.value,
          submittedBy: userName,
          submittedAt: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        }));

      await onSubmitResults(formatted);
      onClose();
    } catch (err) {
      console.error("Failed to submit results:", err);
      alert("Error saving procedure results.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const tasks = procedure?.taskResults ?? [];

  return (
    <Modal isOpen={true} onClose={onClose} title="Perform Procedure">
      <div className="space-y-6">
        {tasks.map((task, index) => (
          <div key={task.taskId} className="border rounded p-4">
            <p className="font-semibold">{task.label}</p>
            {task.type === "pass/fail" ? (
              <select
                value={
                  results[index]?.value === true
                    ? "pass"
                    : results[index]?.value === false
                    ? "fail"
                    : ""
                }
                onChange={(e) => handleResultChange(index, e.target.value)}
                className="border p-2 rounded w-full mt-2"
                disabled={isSubmitting}
              >
                <option value="">-- Select --</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
              </select>
            ) : (
              <input
                type="text"
                value={String(results[index]?.value ?? "")}
                onChange={(e) => handleResultChange(index, e.target.value)}
                className="border p-2 rounded w-full mt-2"
                placeholder="Enter measurement or comment"
                disabled={isSubmitting}
              />
            )}
          </div>
        ))}

        <div className="flex space-x-4 pt-2">
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            Submit Results
          </Button>
          <Button onClick={onClose} variant="ghost" disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PerformProcedureModal;