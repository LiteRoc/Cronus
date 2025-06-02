import { TimeLog } from "../../../types/types";

// ***This should not be needed*** //
const TimeLogList: React.FC<{ logs: TimeLog[] }> = ({ logs }) => {
  return (
    <div>
      <h3>Time Logs</h3>
      {logs.map((log) => (
        <div key={log._id}>
          <p>User ID: {log.userId}</p>
          <p>Time Spent: {log.timeSpent} minutes</p>
          <p>Description: {log.description}</p>
          <p>Timestamp: {new Date(log.timestamp).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
};

export default TimeLogList;
