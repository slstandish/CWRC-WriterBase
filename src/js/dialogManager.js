'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/dialog');
require('jquery-ui/ui/widgets/tooltip');
require('jquery-popup');

var DialogForm = require('./dialogs/dialogForm.js');

var AddSchema = require('./dialogs/addSchema.js');
var LoadingIndicator = require('./dialogs/loadingIndicator.js');
var Header = require('./dialogs/header.js');
var EditSource = require('./dialogs/editSource.js');
var Message = require('./dialogs/message.js');
var Triple = require('./dialogs/triple.js');
var SchemaTags = require('./dialogs/schemaTags.js');
var CopyPaste = require('./dialogs/copyPaste.js');
var Popup = require('./dialogs/popup.js');
var CwrcPerson = require('./dialogs/cwrcPerson.js');
var CwrcPlace = require('./dialogs/cwrcPlace.js');
var CwrcOrg = require('./dialogs/cwrcOrg.js');
var CwrcTitle = require('./dialogs/cwrcTitle.js');
var CwrcCitation = require('./dialogs/cwrcCitation.js');

// TODO hardcoded schemas
var schemaDialogsMaps = {
    tei: require('./schema/tei/dialogs_map.js'),
    orlando: require('./schema/orlando/dialogs_map.js'),
    cwrcEntry: require('./schema/cwrcEntry/dialogs_map.js')
}

function handleResize(dialogEl) {
    if (dialogEl.is(':visible')) {
        if (dialogEl.parent('.ui-dialog').hasClass('popup') == false) {
            var winWidth = $(window).width();
            var winHeight = $(window).height();
            var dialogWidth = dialogEl.dialog('option', 'width');
            var dialogHeight = dialogEl.dialog('option', 'height');
            
            if (dialogWidth > winWidth) {
                dialogEl.dialog('option', 'width', winWidth * 0.8);
            }
            if (dialogHeight > winHeight) {
                dialogEl.dialog('option', 'height', winHeight * 0.8);
            }
            dialogEl.dialog('option', 'position', {my: 'center', at: 'center', of: window});
        }
    }
}

/**
 * @class DialogManager
 * @param {Writer} writer
 */
function DialogManager(writer) {
    var w = writer;
    
    var $cwrcDialogWrapper = $('<div class="cwrc cwrcDialogWrapper"></div>').appendTo(w.layoutManager.getContainer());

    // add event listeners to all of our jquery ui dialogs
    $.extend($.ui.dialog.prototype.options, {
        appendTo: $cwrcDialogWrapper,
        create: function(e) {
            $(e.target).on('dialogopen', function(event) {
                handleResize($(event.target));
                $(window).on('resize', $.proxy(handleResize, this, $(event.target)));
            }).on('dialogclose', function(event) {
                $(window).off('resize', $.proxy(handleResize, this, $(event.target)));
            });
        }
    });
    
    // do the same for tooltips
    $.extend($.ui.tooltip.prototype.options, {
        open: function(e, ui) {
            var instance = $(this).tooltip('instance');
            instance.liveRegion = instance.liveRegion.appendTo($cwrcDialogWrapper);
        }
    });
    
    // do the same for popups
    $.extend($.custom.popup.prototype.options, {
        appendTo: $cwrcDialogWrapper,
        create: function(e) {
            $(e.target).on('popupopen', function(event) {
                handleResize($(event.target));
                $(window).on('resize', $.proxy(handleResize, this, $(event.target)));
            }).on('popupclose', function(event) {
                $(window).off('resize', $.proxy(handleResize, this, $(event.target)));
            });
        }
    });
    
    // dialog name, class map
    var dialogs = {};
    
    // schema dialogs name, class map
    var schemaDialogs = {
    };
    
    /**
     * @lends DialogManager.prototype
     */
    var dm = {};

    dm.addDialog = function(dialogName, DialogClass) {
        var dialog = new DialogClass(w, $cwrcDialogWrapper);
        if (dialog.show === undefined) {
            if (window.console) {
                console.warn(dialogName+" doesn't have required method \"show\"!");
            }
        }
        if (dialog.destroy === undefined) {
            if (window.console) {
                console.warn(dialogName+" doesn't have required method \"destroy\"!");
            }
        }
        dialogs[dialogName] = dialog;
        return dialog;
    };
    
    dm.getDialog = function(dialogName) {
        return dialogs[dialogName];
    };
    
    dm.getDialogWrapper = function() {
        return $cwrcDialogWrapper;
    };
    
    dm.show = function(type, config) {
        var dialog;
        if (type.indexOf('schema/') === 0) {
            var typeParts = type.split('/');
            type = typeParts[1];
            dialog = schemaDialogs[w.schemaManager.getCurrentSchema().schemaMappingsId][type];
        } else {
            if (dialogs[type]) {
                dialog = dialogs[type];
            } else if (schemaDialogs[w.schemaManager.getCurrentSchema().schemaMappingsId][type]) {
                dialog = schemaDialogs[w.schemaManager.getCurrentSchema().schemaMappingsId][type];
            }
        }
        if (dialog !== undefined) {
            dialog.show(config);
        }
    };
    
    dm.confirm = function(config) {
        dialogs.message.confirm(config);
    };
    
    dm.destroy = function() {
        for (var schema in schemaDialogs) {
            var dialogsForSchema = schemaDialogs[schema];
            for (var d in dialogsForSchema) {
                dialogsForSchema[d].destroy();
            }
        }
        
        for (var d in dialogs) {
            if (dialogs[d].destroy !== undefined) {
                dialogs[d].destroy();
            } else {
                if (window.console) console.warn('cannot destroy', d);
            }
        }
    };
    
    var defaultDialogs = {
        message: Message,
        popup: Popup,
        copyPaste: CopyPaste,
        triple: Triple,
        loadingindicator: LoadingIndicator,
        addschema: AddSchema,
        person: CwrcPerson,
        org: CwrcOrg,
        title: CwrcTitle,
        citation: CwrcCitation,
        place: CwrcPlace,
        schemaTags: SchemaTags
    };
    
    if (w.isReadOnly !== true && w.isAnnotator !== true && w.isEmbedded !== true) {
        defaultDialogs.header = Header;
        defaultDialogs.editSource = EditSource;
    }
    
    for (var dialogName in defaultDialogs) {
        dm.addDialog(dialogName, defaultDialogs[dialogName]);
    }

    var loadSchemaDialogs = function() {
        var schemaMappingsId = w.schemaManager.getCurrentSchema().schemaMappingsId;
        
        if (schemaDialogs[schemaMappingsId] === undefined) {
            schemaDialogs[schemaMappingsId] = {};
            
            // TODO destroy previously loaded dialogs
            for (var dialogName in schemaDialogsMaps[schemaMappingsId]) {
                var dialog = schemaDialogsMaps[schemaMappingsId][dialogName];
                schemaDialogs[schemaMappingsId][dialogName] = new dialog(w, $cwrcDialogWrapper);
            }
        }
    };

    w.event('schemaLoaded').subscribe(loadSchemaDialogs);

    return dm;
};

module.exports = DialogManager;