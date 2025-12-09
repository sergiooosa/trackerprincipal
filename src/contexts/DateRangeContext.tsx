"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type DateRangeContextType = {
  startDate: Date | null;
  endDate: Date | null;
  setDateRange: (start: Date | null, end: Date | null) => void;
};

const DateRangeContext = createContext<DateRangeContextType>({
  startDate: null,
  endDate: null,
  setDateRange: () => {},
});

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const setDateRange = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <DateRangeContext.Provider value={{ startDate, endDate, setDateRange }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  return useContext(DateRangeContext);
}

