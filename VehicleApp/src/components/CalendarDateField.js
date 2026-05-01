import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow, Spacing } from '../constants/theme';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function parseDateString(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDateString(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(left, right) {
  if (!left || !right) {
    return false;
  }

  return (
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
  );
}

function buildCalendarDays(monthDate) {
  const firstDay = startOfMonth(monthDate);
  const startWeekDay = firstDay.getDay();
  const firstGridDate = new Date(firstDay);
  firstGridDate.setDate(firstDay.getDate() - startWeekDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDate);
    date.setDate(firstGridDate.getDate() + index);
    return date;
  });
}

function formatDisplayDate(value) {
  const date = parseDateString(value);
  if (!date) {
    return 'Select date';
  }

  return `${date.getDate()} ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

export default function CalendarDateField({
  label,
  value,
  onChange,
  minDate,
  error,
}) {
  const [visible, setVisible] = useState(false);
  const minDateObj = useMemo(() => parseDateString(minDate), [minDate]);
  const selectedDate = useMemo(() => parseDateString(value), [value]);
  const [displayMonth, setDisplayMonth] = useState(
    startOfMonth(selectedDate || minDateObj || new Date()),
  );

  useEffect(() => {
    if (visible) {
      setDisplayMonth(startOfMonth(selectedDate || minDateObj || new Date()));
    }
  }, [visible, selectedDate, minDateObj]);

  const calendarDays = useMemo(() => buildCalendarDays(displayMonth), [displayMonth]);

  const canGoPrevious = useMemo(() => {
    if (!minDateObj) {
      return true;
    }

    const previousMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1);
    const minMonth = new Date(minDateObj.getFullYear(), minDateObj.getMonth(), 1);
    return previousMonth >= minMonth;
  }, [displayMonth, minDateObj]);

  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        style={[styles.fieldButton, error && styles.fieldButtonError]}
        onPress={() => setVisible(true)}
        activeOpacity={0.88}
      >
        <Text style={styles.fieldValue}>{formatDisplayDate(value)}</Text>
        <MaterialCommunityIcons name="calendar-month-outline" size={20} color={Colors.muted} />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayTap} activeOpacity={1} onPress={() => setVisible(false)} />

          <View style={styles.modalCard}>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>{label}</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setVisible(false)} activeOpacity={0.88}>
                <MaterialCommunityIcons name="close" size={20} color="#111111" />
              </TouchableOpacity>
            </View>

            <View style={styles.monthRow}>
              <TouchableOpacity
                style={[styles.monthButton, !canGoPrevious && styles.monthButtonDisabled]}
                onPress={() => {
                  if (canGoPrevious) {
                    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1));
                  }
                }}
                disabled={!canGoPrevious}
                activeOpacity={0.88}
              >
                <MaterialCommunityIcons name="chevron-left" size={22} color={canGoPrevious ? '#111111' : '#94a3b8'} />
              </TouchableOpacity>

              <Text style={styles.monthTitle}>
                {MONTH_LABELS[displayMonth.getMonth()]} {displayMonth.getFullYear()}
              </Text>

              <TouchableOpacity
                style={styles.monthButton}
                onPress={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}
                activeOpacity={0.88}
              >
                <MaterialCommunityIcons name="chevron-right" size={22} color="#111111" />
              </TouchableOpacity>
            </View>

            <View style={styles.weekHeader}>
              {DAY_LABELS.map((labelValue) => (
                <Text key={labelValue} style={styles.weekLabel}>{labelValue}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {calendarDays.map((date) => {
                const isCurrentMonth = date.getMonth() === displayMonth.getMonth();
                const disabled = !isCurrentMonth || (minDateObj && date < minDateObj);
                const selected = isSameDay(date, selectedDate);

                return (
                  <TouchableOpacity
                    key={date.toISOString()}
                    style={[
                      styles.dayCell,
                      selected && styles.dayCellSelected,
                      disabled && styles.dayCellDisabled,
                    ]}
                    disabled={disabled}
                    activeOpacity={0.88}
                    onPress={() => {
                      onChange(formatDateString(date));
                      setVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.dayTextSelected,
                        disabled && styles.dayTextDisabled,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  fieldButton: {
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.stroke,
    backgroundColor: Colors.soft,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldButtonError: {
    borderColor: Colors.danger,
  },
  fieldValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  overlayTap: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
    ...Shadow.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonDisabled: {
    opacity: 0.5,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: Colors.muted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  dayCellSelected: {
    backgroundColor: '#facc15',
  },
  dayCellDisabled: {
    opacity: 0.28,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  dayTextSelected: {
    color: '#111111',
    fontWeight: '900',
  },
  dayTextDisabled: {
    color: '#94a3b8',
  },
});
