import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const STATUS_FILE = '/tmp/groq-voice-status';
const POLL_INTERVAL_MS = 500;

const VoiceIndicator = GObject.registerClass(
class VoiceIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Groq Voice Indicator', true);

        this._label = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-size: 13px; padding: 0 6px;',
        });
        this.add_child(this._label);

        this._status = 'idle';
        this._recordingStartSec = 0;
        this._timeoutId = null;

        this.hide();
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

        // Transition into a new state
        if (status !== this._status) {
            this._status = status;

            if (status === 'recording') {
                this._recordingStartSec = GLib.get_real_time() / 1_000_000;
                this.show();
            } else if (status === 'recognizing') {
                this._label.set_text('⏳ Распознаю...');
                this.show();
            } else {
                // idle or unknown — hide
                this.hide();
                return;
            }
        }

        // Keep timer updated while recording
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
