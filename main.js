import { SchedulerPro } from '@bryntum/schedulerpro';

// Toggle with ?workaround in the URL
const useWorkaround = new URLSearchParams(location.search).has('workaround');

const logElement = document.getElementById('log');
const log = message => {
    logElement.textContent = `${new Date().toLocaleTimeString()}  ${message}\n` + logElement.textContent;
};

document.getElementById('mode').textContent = useWorkaround ? 'with workaround' : 'out of the box';
const toggle = document.getElementById('toggle');
toggle.textContent = useWorkaround ? 'switch to out of the box' : 'switch to workaround';
toggle.href = useWorkaround ? '?' : '?workaround';

// The thrown TypeError does not reach any listener, so it is caught at the window
window.addEventListener('error', ({ message }) => log(`UNCAUGHT  ${message}`));
window.addEventListener('unhandledrejection', ({ reason }) => log(`UNHANDLED  ${reason?.message ?? reason}`));

const MONDAY = new Date(2026, 9, 5);
const at = (dayOffset, hour) => new Date(MONDAY.getFullYear(), MONDAY.getMonth(), MONDAY.getDate() + dayOffset, hour);

const isCopy = eventDrag => eventDrag.mode === 'copy';

/**
 * What we do today to copy one occurrence. Both halves reach past the documented surface, which is what the forum
 * post asks about.
 */
const occurrenceCopyWorkaround = {
    async updateRecordsFn(dragData) {
        const { eventRecords, eventBarEls, startDate, endDate, newResource } = dragData;
        const [eventRecord] = eventRecords;
        if (!eventRecord?.isOccurrence || !isCopy(this)) {
            await this.updateRecords(dragData);
            return;
        }
        // An occurrence is in no store, so the copy is built from the event record (not its assignment) and stripped
        // of the rule, otherwise it would paste a second series.
        const [copy] = this.client.eventStore.add(eventRecord.copy({ recurrenceRule : null, exceptionDates : null }));
        copy.set({ startDate, endDate, resourceId : newResource?.id ?? eventRecord.resourceId });
        // Question 2: the drag moved the original's own bar by inline style, so the redraw finds a config equal to the
        // cached one and skips it, leaving the original drawn on the target row. Dropping the private per-element
        // cache is the only way we found to force it back.
        eventBarEls.forEach(eventBarEl => delete eventBarEl.lastDomConfig);
        this.client.refreshRows();
        await this.client.project.commitAsync();
        log(`workaround  copy added, store now ${this.client.eventStore.count} events`);
    }
};

const scheduler = new SchedulerPro({
    appendTo   : 'container',
    startDate  : at(0, 0),
    endDate    : at(28, 0),
    viewPreset : 'weekAndDay',
    tickSize   : 90,
    barMargin  : 6,

    // `single` answers the recurrence confirmation without showing it, so the drop runs in one gesture. The popup
    // reaches the same code path: the stack below goes through RecurrenceConfirmationPopup either way.
    enableRecurringEvents : { defaultAction : 'single' },

    features : {
        eventDrag      : { copyKey : 'CTRL', ...(useWorkaround ? occurrenceCopyWorkaround : {}) },
        eventCopyPaste : true
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
        beforeEventDropFinalize({ source, context }) {
            const copyingOccurrence = isCopy(source.features.eventDrag) && context.eventRecords.some(record => record.isOccurrence);
            log(`beforeEventDropFinalize  mode: ${source.features.eventDrag.mode}  occurrence: ${context.eventRecords.some(r => r.isOccurrence)}`);
            if (useWorkaround && copyingOccurrence) {
                // Returning false stops Bryntum's recurrence listener without cancelling the drop, so the original
                // is not detached from its series.
                return false;
            }
        },

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
