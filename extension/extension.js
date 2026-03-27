import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const STATUS_FILE = '/tmp/groq-voice-status';
const STATS_FILE = GLib.get_home_dir() + '/.local/share/groq-voice/stats.json';
const POLL_INTERVAL_MS = 500;

const VoiceIndicator = GObject.registerClass(
class VoiceIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Groq Voice', false);

        this._label = new St.Label({
            text: '🎤',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-size: 13px; padding: 0 6px;',
        });
        this.add_child(this._label);

        this._buildMenu();

        this._status = 'idle';
        this._recordingStartSec = 0;
        this._timeoutId = null;

        this.show();
    }

    // Creates a two-column stat row: "Label" on the left, "value" bold on the right.
    // reactive:false + explicit opacity:1 prevents GNOME's :insensitive greying.
    _makeStatRow(labelText) {
        const item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        item.style = 'opacity: 1;';

        const nameLabel = new St.Label({
            text: labelText,
            x_expand: true,
            style_class: 'dim-label',
        });

        const valueLabel = new St.Label({
            text: '—',
            style: 'font-weight: bold;',
        });

        item.add_child(nameLabel);
        item.add_child(valueLabel);

        return {item, valueLabel};
    }

    _buildMenu() {
        // Standard GNOME section header with separator line
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Groq Voice'));

        const todayRow = this._makeStatRow('Today');
        this._todayValue = todayRow.valueLabel;
        this.menu.addMenuItem(todayRow.item);

        const monthRow = this._makeStatRow('This month');
        this._monthValue = monthRow.valueLabel;
        this.menu.addMenuItem(monthRow.item);

        this.menu.connect('open-state-changed', (_menu, isOpen) => {
            if (isOpen) this._updateMenu();
        });
    }

    _readStats() {
        try {
            const file = Gio.File.new_for_path(STATS_FILE);
            const [ok, contents] = file.load_contents(null);
            if (ok)
                return JSON.parse(new TextDecoder().decode(contents));
        } catch (_e) {}
        return {};
    }

    _formatDuration(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    _updateMenu() {
        const stats = this._readStats();
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const monthPrefix = today.slice(0, 7);

        const td = stats[today] || {requests: 0, seconds: 0};
        this._todayValue.set_text(
            `${td.requests} req · ${this._formatDuration(td.seconds)}`
        );

        let mReq = 0, mSec = 0;
        for (const [d, v] of Object.entries(stats)) {
            if (d.startsWith(monthPrefix)) {
                mReq += v.requests;
                mSec += v.seconds;
            }
        }
        this._monthValue.set_text(
            `${mReq} req · ${this._formatDuration(mSec)}`
        );
    }

    startPolling() {
        if (this._timeoutId !== null)
            return;
        this._timeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            POLL_INTERVAL_MS,
            () => { this._poll(); return GLib.SOURCE_CONTINUE; }
        );
    }

    stopPolling() {
        if (this._timeoutId !== null) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
    }

    _readStatus() {
        try {
            const file = Gio.File.new_for_path(STATUS_FILE);
            const [ok, contents] = file.load_contents(null);
            if (ok)
                return new TextDecoder().decode(contents).trim();
        } catch (_e) {}
        return 'idle';
    }

    _poll() {
        const status = this._readStatus();

        if (status !== this._status) {
            this._status = status;

            if (status === 'recording') {
                this._recordingStartSec = GLib.get_real_time() / 1_000_000;
            } else if (status === 'recognizing') {
                this._label.set_text('⏳ Recognizing...');
            } else {
                this._label.set_text('🎤');
            }
        }

        if (this._status === 'recording') {
            const elapsed = Math.floor(
                GLib.get_real_time() / 1_000_000 - this._recordingStartSec
            );
            const m = Math.floor(elapsed / 60);
            const s = (elapsed % 60).toString().padStart(2, '0');
            this._label.set_text(`🎙 ${m}:${s}`);
        }
    }

    destroy() {
        this.stopPolling();
        super.destroy();
    }
});

export default class VoiceInputExtension {
    constructor(metadata) {
        this._metadata = metadata;
        this._indicator = null;
    }

    enable() {
        this._indicator = new VoiceIndicator();
        Main.panel.addToStatusArea('groq-voice-indicator', this._indicator);
        this._indicator.startPolling();
    }

    disable() {
        if (this._indicator) {
            this._indicator.stopPolling();
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
