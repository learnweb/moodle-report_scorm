define(['jquery', 'core/notification', 'core/custom_interaction_events', 'core/modal', 'core/modal_registry'],
    function($, Notification, CustomEvents, Modal, ModalRegistry) {
        var registered = false;
        var SELECTORS = {
            LOGIN_BUTTON: '[data-action="login"]',
            CANCEL_BUTTON: '[data-action="cancel"]',
        };

        /**
         * Constructor for the Modal.
         *
         * @param {object} root The root jQuery element for the modal
         */
        var ModalPassgrade = function(root) {
            Modal.call(this, root);

            if (!this.getFooter().find(SELECTORS.LOGIN_BUTTON).length) {
                Notification.exception({message: 'No login button found'});
            }

            if (!this.getFooter().find(SELECTORS.CANCEL_BUTTON).length) {
                Notification.exception({message: 'No cancel button found'});
            }
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

            this.getModal().on(CustomEvents.events.activate, SELECTORS.LOGIN_BUTTON, function(e, data) {
                this.savepressedcallback();
                // Add your logic for when the login button is clicked. This could include the form validation,
                // loading animations, error handling etc.
            }.bind(this));

            this.getModal().on(CustomEvents.events.activate, SELECTORS.CANCEL_BUTTON, function(e, data) {
                // Add your logic for when the cancel button is clicked.
                this.hide();
            }.bind(this));
        };

        // Automatically register with the modal registry the first time this module is imported so that you can create modals
        // of this type using the modal factory.
        if (!registered) {
            ModalRegistry.register(ModalPassgrade.TYPE, ModalPassgrade, 'scormreport_heatmap/modal_passgrade');
            registered = true;
        }

        return ModalPassgrade;
    }
);