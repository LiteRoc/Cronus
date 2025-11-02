// src/components/DatePicker.tsx
import { useState } from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";


export const DatePicker: React.FC<{
    value: Date | null;
    onChange: (date: Date | null) => void;
    disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    disabled={disabled}
                >
                {value ? format(value, "yyyy-MM-dd") : <span className="text-muted-foreground">Pick a date</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
            <Calendar
                mode="single"
                selected={value ?? undefined}
                onSelect={onChange}
                initialFocus
                />
            </PopoverContent>
        </Popover>
    );
};