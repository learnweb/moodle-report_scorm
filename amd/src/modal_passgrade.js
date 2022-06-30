define(['jquery', 'core/notification', 'core/custom_interaction_events', 'core/modal', 'core/modal_registry'],
    function($, Notification, CustomEvents, Modal, ModalRegistry) {
        var registered = false;
        var SELECTORS = {
            SAVE_BUTTON: '[data-action="inputpercentage"]',
            CANCEL_BUTTON: '[data-action="cancel"]',
        };

        /**
         * Constructor for the Modal.
         *
         * @param {object} root The root jQuery element for the modal
         */
        var ModalPassgrade = function(root) {
            Modal.call(this, root);
        };

        ModalPassgrade.TYPE = 'scormreport_heatmap-passgrade';
        ModalPassgrade.prototype = Object.create(Modal.prototype);
        ModalPassgrade.prototype.constructor = ModalPassgrade;
        ModalPassgrade.prototype.savepressedcallback = (formdata) => { // eslint-disable-line
            window.console.log("Save pressed but callback not overwritten");
        };

        /**
         * Set up all of the event handling for the modal.
         *
         * @method registerEventListeners
         */
        ModalPassgrade.prototype.registerEventListeners = function() {
            // Apply parent event listeners.
            Modal.prototype.registerEventListeners.call(this);

            this.getModal().on(CustomEvents.events.activate, SELECTORS.SAVE_BUTTON, function() {
                this.savepressedcallback();
            }.bind(this));

            this.getModal().on(CustomEvents.events.activate, SELECTORS.CANCEL_BUTTON, function() {
                this.hide();
            }.bind(this));
        };

        if (!registered) {
            ModalRegistry.register(ModalPassgrade.TYPE, ModalPassgrade, 'scormreport_heatmap/modal_passgrade');
            registered = true;
        }

        return ModalPassgrade;
    }
);