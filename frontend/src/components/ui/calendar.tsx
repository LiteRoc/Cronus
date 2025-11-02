// src/components/ui/calendar.tsx
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";


export const Calendar = ({ ...props }) => {
    return (
        <DayPicker
            className="bg-white border rounded shadow-sm"
            showOutsideDays
            fixedWeeks
            {...props}
        />
    );
};