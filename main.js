import { SchedulerPro } from '@bryntum/schedulerpro';

const logElement = document.getElementById('log');
const log = message => {
    logElement.textContent = `${new Date().toLocaleTimeString()}  ${message}\n` + logElement.textContent;
};

// The thrown TypeError does not reach any listener, so it is caught at the window
window.addEventListener('error', ({ message }) => log(`UNCAUGHT  ${message}`));
window.addEventListener('unhandledrejection', ({ reason }) => log(`UNHANDLED  ${reason?.message ?? reason}`));

const MONDAY = new Date(2026, 9, 5);
const at = (dayOffset, hour) => new Date(MONDAY.getFullYear(), MONDAY.getMonth(), MONDAY.getDate() + dayOffset, hour);

const scheduler = new SchedulerPro({
    appendTo   : 'container',
    startDate  : at(0, 0),
    endDate    : at(28, 0),
    viewPreset : 'weekAndDay',
    tickSize   : 90,
    barMargin  : 6,

    // `single` answers the recurrence confirmation without showing it, so the drop runs in one gesture. The popup
    // reaches the same code path: the stack goes through RecurrenceConfirmationPopup either way.
    enableRecurringEvents : { defaultAction : 'single' },

    features : {
        eventDrag : { copyKey : 'CTRL' }
    },

    columns : [{ text : 'Employee', field : 'name', width : 160 }],

    project : {
        resources : [
            { id : 1, name : 'Anna' },
            { id : 2, name : 'Ben' }
        ],
        events : [
            {
                id             : 1,
                resourceId     : 1,
                name           : 'Weekly standup',
                startDate      : at(0, 8),
                endDate        : at(0, 18),
                recurrenceRule : 'FREQ=WEEKLY;COUNT=4'
            },
            // Same gesture on a bar that repeats nothing: this one copies fine
            { id : 2, resourceId : 2, name : 'Plain shift', startDate : at(1, 8), endDate : at(1, 18) }
        ]
    },

    listeners : {
        eventDrop({ source, eventRecords }) {
            log(`eventDrop  ${eventRecords.map(e => e.name).join(', ')}  store: ${source.eventStore.count} events`);
        },

        afterEventDrop({ source }) {
            const master = source.eventStore.getById(1);
            log(`afterEventDrop  store: ${source.eventStore.count}  rule: ${master?.recurrenceRule ?? '(none)'}  occurrences: ${master?.occurrences.length}`);
        }
    }
});

window.scheduler = scheduler;
log(`ready  store: ${scheduler.eventStore.count} events  occurrences of "Weekly standup": ${scheduler.eventStore.getById(1).occurrences.length}`);
