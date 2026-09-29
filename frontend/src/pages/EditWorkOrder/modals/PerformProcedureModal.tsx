import React, { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { TaskResult, WorkOrderProcedure } from '@/types';
import { Button } from '@/components/ui/button';
import { measurementContext, measurementEvaluation, measurementUnit } from '@/utils/procedureMeasurements';

interface PerformProcedureModalProps {
  procedure: WorkOrderProcedure;
  onSubmitResults: (results: TaskResult[]) => Promise<void>;
  onClose: () => void;
  userId: string;
  userName: string;
}

const PerformProcedureModal: React.FC<PerformProcedureModalProps> = ({ procedure, onSubmitResults, onClose }) => {
  const [values, setValues] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const tasks = procedure.taskResults ?? [];

  useEffect(() => {
    setValues((procedure.taskResults || []).map(task => {
      if (task.type === 'pass/fail') return task.value === true ? 'pass' : task.value === false ? 'fail' : '';
      if (task.type === 'measurement') return typeof task.value === 'number' && Number.isFinite(task.value) ? String(task.value) : '';
      return task.value == null ? '' : String(task.value);
    }));
    setError('');
  }, [procedure]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const results: TaskResult[] = [];
    for (const [index, task] of tasks.entries()) {
      const text = values[index] ?? '';
      let value: TaskResult['value'] = text;
      if (task.type === 'measurement') {
        if (!text.trim()) {
          if (task.measurementSnapshot?.required !== false) {
            setError(`${task.label}: a numeric reading is required.`); return;
          }
          value = null;
        } else {
          value = Number(text);
          if (!Number.isFinite(value)) { setError(`${task.label}: enter a valid number.`); return; }
        }
      } else if (task.type === 'pass/fail') value = text === 'pass' ? true : text === 'fail' ? false : null;
      results.push({ taskId: task.taskId, type: task.type, label: task.label, value });
    }
    setIsSubmitting(true);
    try { await onSubmitResults(results); onClose(); }
    catch { setError('Results could not be saved. Reload the work order and retry.'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Perform Procedure">
      <form className="space-y-6" onSubmit={handleSubmit}>
        {tasks.map((task, index) => {
          const id = `procedure-reading-${index}`;
          const unit = task.type === 'measurement' ? measurementUnit(task) : '';
          const numeric = values[index]?.trim() ? Number(values[index]) : null;
          return <div key={task.taskId} className="border rounded p-4">
            <label htmlFor={id} className="font-semibold">{task.label}</label>
            {task.type === 'pass/fail' ? (
              <select id={id} value={values[index] ?? ''} disabled={isSubmitting}
                onChange={e => setValues(previous => previous.map((v, i) => i === index ? e.target.value : v))}
                className="border p-2 rounded w-full mt-2">
                <option value="">-- Select --</option><option value="pass">Pass</option><option value="fail">Fail</option>
              </select>
            ) : <div className="flex items-center gap-2 mt-2">
              <input id={id} type={task.type === 'measurement' ? 'number' : 'text'}
                step={task.type === 'measurement' ? 'any' : undefined}
                required={task.type === 'measurement' && task.measurementSnapshot?.required !== false}
                aria-describedby={task.type === 'measurement' ? `${id}-context ${id}-evaluation` : undefined}
                value={values[index] ?? ''} disabled={isSubmitting}
                onChange={e => setValues(previous => previous.map((v, i) => i === index ? e.target.value : v))}
                className="border p-2 rounded w-full" />
              {unit && <span>{unit}</span>}
            </div>}
            {task.type === 'measurement' && <>
              <p id={`${id}-context`} className="text-sm text-gray-600">{measurementContext(task)}</p>
              <p id={`${id}-evaluation`} role="status">{measurementEvaluation({ ...task, completed: false }, numeric)}</p>
              {task.value != null && typeof task.value !== 'number' &&
                <p>Previous reading: {String(task.value)}. Enter a numeric reading to replace it.</p>}
            </>}
          </div>;
        })}
        {error && <p role="alert">{error}</p>}
        <div className="flex space-x-4 pt-2">
          <Button type="submit" disabled={isSubmitting}>Submit Results</Button>
          <Button type="button" onClick={onClose} variant="ghost" disabled={isSubmitting}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
};

export default PerformProcedureModal;
