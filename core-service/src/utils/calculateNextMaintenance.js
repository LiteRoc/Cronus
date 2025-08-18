const calculateNextMaintenance = (frequency, currentDate) => {
    const nextDate = new Date(currentDate);
    switch (frequency) {
        case 'Monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
        case 'Quarterly':
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
        case 'Yearly':
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        default:
            throw new Error(`Unknown maintenance frequency: ${frequency}`);
    }
    return nextDate;
};

module.exports = calculateNextMaintenance;
