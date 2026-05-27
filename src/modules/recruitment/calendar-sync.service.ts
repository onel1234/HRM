import { Injectable, Logger } from '@nestjs/common';

/**
 * Calendar sync service using iCal (.ics) file generation.
 * Generates standard iCalendar format files for interview scheduling.
 */
@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  /**
   * Generate iCal (.ics) content for an interview event.
   */
  generateIcsContent(event: {
    uid: string;
    summary: string;
    description?: string;
    location?: string;
    startTime: Date;
    durationMinutes: number;
    organizerEmail: string;
    organizerName: string;
    attendeeEmail?: string;
    attendeeName?: string;
  }): string {
    const start = this.formatDateToIcs(event.startTime);
    const endTime = new Date(
      event.startTime.getTime() + event.durationMinutes * 60 * 1000,
    );
    const end = this.formatDateToIcs(endTime);
    const now = this.formatDateToIcs(new Date());

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HR System//Interview Scheduler//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${this.escapeIcsText(event.summary)}`,
    ];

    if (event.description) {
      lines.push(`DESCRIPTION:${this.escapeIcsText(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${this.escapeIcsText(event.location)}`);
    }

    lines.push(
      `ORGANIZER;CN=${event.organizerName}:mailto:${event.organizerEmail}`,
    );

    if (event.attendeeEmail) {
      lines.push(
        `ATTENDEE;CN=${event.attendeeName || event.attendeeEmail};RSVP=TRUE:mailto:${event.attendeeEmail}`,
      );
    }

    lines.push('STATUS:CONFIRMED', 'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Interview Reminder', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');

    return lines.join('\r\n');
  }

  private formatDateToIcs(date: Date): string {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  }

  private escapeIcsText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }
}
