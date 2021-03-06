var $ = require('jquery');
var _ = require('underscore');
var Backbone = require('backbone');
var UIConfig = require('../../../../config/ui.json');
var marked = require('marked');
var MarkdownEditor = require('../../../../components/markdown_editor');
var TagFactory = require('../../../../components/tag_factory');
var ShowMarkdownMixin = require('../../../../components/show_markdown_mixin');
var TaskFormViewHelper = require('../../task-form-view-helper');
var TaskEditFormTemplate = require('../templates/task_edit_form_template.html');
var ModalComponent = require('../../../../components/modal');

var TaskEditFormView = Backbone.View.extend({

  events: {
    'blur .validate'                   : 'validateField',
    'keyup .validate'                  : 'validateField',
    'change .validate'                 : 'validateField',
    'click #change-owner'              : 'displayChangeOwner',
    'click #add-participant'           : 'displayAddParticipant',
    'click #task-view'                 : 'view',
    'submit #task-edit-form'           : 'save',
    'click .draft-button'              : 'submit',
    'click [name=task-time-required]' : 'toggleTimeOptions',
  },

  initialize: function (options) {
    _.extend(this, Backbone.Events);

    var view                    = this;
    this.options                = options;
    this.tagFactory             = new TagFactory();
    this.agency                 = this.model.get( 'restrict' );
    this.data                   = {};
    this.data.newTag            = {};

    TaskFormViewHelper.annotateTimeRequired(options.tagTypes['task-time-required'], this.agency);
    this.tagSources = options.tagTypes;  // align with naming in TaskFormView, so we can share completionDate

    this.initializeListeners();

    this.listenTo(this.options.model, 'task:update:success', function (data) {
      Backbone.history.navigate('tasks/' + data.attributes.id, { trigger: true });
      if(data.attributes.state == 'submitted') {
        this.modalComponent = new ModalComponent({
          el: '#site-modal',
          id: 'submit-opp',
          modalTitle: 'Submitted',
          modalBody: 'Thanks for submitting the <strong>' + data.attributes.title + '</strong>. We\'ll review it and let you know if it\'s approved or if we need more information.',
          primary: {
            text: 'Close',
            action: function () {
              this.modalComponent.cleanup();
            }.bind(this),
          },
        }).render();
      }
    });
    this.listenTo(this.options.model, 'task:update:error', function (model, response, options) {
      var error = options.xhr.responseJSON;
      if (error && error.invalidAttributes) {
        for (var item in error.invalidAttributes) {
          if (error.invalidAttributes[item]) {
            message = _(error.invalidAttributes[item]).pluck('message').join(',<br /> ');
            $('#' + item + '-update-alert-message').html(message);
            $('#' + item + '-update-alert').show();
          }
        }
      } else if (error) {
        var alertText = response.statusText + '. Please try again.';
        $('.alert.alert-danger').text(alertText).show();
        $(window).animate({ scrollTop: 0 }, 500);
      }
    });
  },

  view: function (e) {
    if (e.preventDefault) e.preventDefault();
    Backbone.history.navigate('tasks/' + this.model.attributes.id, { trigger: true });
  },

  /*
   * Render modal for the Task Creation Form ViewController
   */
  renderSaveSuccessModal: function () {
    var $modal = this.$( '.js-success-message' );
    $modal.slideDown( 'slow' );
    $modal.one('mouseout', function () {
      _.delay( _.bind( $modal.slideUp, $modal, 'slow' ), 4200 );
    });
  },

  validateField: function (e) {
    return validate(e);
  },

  render: function () {
    var compiledTemplate;

    this.data = {
      data: this.model.toJSON(),
      tagTypes: this.options.tagTypes,
      newTags: [],
      newItemTags: [],
      tags: this.options.tags,
      madlibTags: this.options.madlibTags,
      ui: UIConfig,
      agency: this.agency,
    };

    compiledTemplate = _.template(TaskEditFormTemplate)(this.data);
    this.$el.html(compiledTemplate);
    this.$el.localize();

    // DOM now exists, begin select2 init
    this.initializeSelect2();
    this.initializeTextArea();
    this.initializeShowMarkdown({
      el               : '.show-markdown',
      id               : 'show-default-description',
      displayCondition : 'Full Time Detail',
      textAreaId       : 'task-description',
    });

    this.$( '.js-success-message' ).hide();
    this.toggleTimeOptions();
  },

  initializeSelect2: function () {
    var formatResult = function (object) {
      var formatted = '<div class="select2-result-title">';
      formatted += _.escape(object.name || object.title);
      formatted += '</div>';
      if (!_.isUndefined(object.description)) {
        formatted += '<div class="select2-result-description">' + marked(object.description) + '</div>';
      }
      return formatted;
    };

    this.$('#owner').select2({
      placeholder: 'task owner',
      multiple: false,
      formatResult: formatResult,
      formatSelection: formatResult,
      allowClear: false,
      ajax: {
        url: '/api/ac/user',
        dataType: 'json',
        data: function (term) {
          return { q: term };
        },
        results: function (data) {
          return { results: data };
        },
      },
    });
    if (this.data.data.owner) {
      this.$('#owner').select2('data', this.data.data.owner);
    }

    this.$('#participant').select2({
      placeholder: 'Add participant',
      multiple: false,
      formatResult: formatResult,
      formatSelection: formatResult,
      allowClear: false,
      ajax: {
        url: '/api/ac/user',
        dataType: 'json',
        data: function (term) {
          return { q: term };
        },
        results: function (data) {
          return { results: data };
        },
      },
    });

    this.tagFactory.createTagDropDown({
      type: 'skill',
      selector: '#task_tag_skills',
      width: '100%',
      tokenSeparators: [','],
      data: this.data['madlibTags'].skill,
    });

    this.tagFactory.createTagDropDown({
      type: 'location',
      selector: '#task_tag_location',
      width: '100%',
      data: this.data['madlibTags'].location,
    });

    $('#skills-required').select2({
      placeholder: 'required/not-required',
      width: '100%',
    });

    $('#time-required').select2({
      placeholder: 'time-required',
      width: '100%',
    });

    $('#js-time-frequency-estimate').select2({
      placeholder: 'time-frequency',
      width: '100%',
    });

    $('#length').select2({
      placeholder: 'length',
      width: '100%',
    });

    $('#time-estimate').select2({
      placeholder: 'time-estimate',
      width: '100%',
    });

    $('#task-location').select2({
      placeholder: 'location',
      width: '100%',
    });

    $('#people').select2({
      placeholder: 'task-people',
      width: '100%',
    });

  },

  initializeTextArea: function () {
    if (this.md) { this.md.cleanup(); }
    this.md = new MarkdownEditor({
      data: this.model.toJSON().description,
      el: '.markdown-edit',
      id: 'task-description',
      placeholder: 'Description of opportunity including goals, expected outcomes and deliverables.',
      title: 'Opportunity Description',
      rows: 6,
      validate: ['empty','html'],
    }).render();
  },

  /*
   * Initialize the `task:tags:save:done` listener for this view.
   * The event is triggered from the `submit` & `saveDraft` methods.
   */
  initializeListeners: function () {
    var view = this;

    this.on( 'task:tags:save:done', function ( event ) {
      var owner          = this.$( '#owner' ).select2( 'data' );
      var completedBy    = this.$('[name=task-time-required]:checked').attr('data-descr') == 'One time' ?  TaskFormViewHelper.getCompletedByDate() : null;
      //var newParticipant = this.$( '#participant' ).select2( 'data' );
      var silent         = true;

      var modelData = {
        id          : this.model.get( 'id' ),
        title       : this.$( '#task-title' ).val(),
        description : this.$( '#task-description' ).val(),
        submittedAt : this.$( '#js-edit-date-submitted' ).val() || undefined,
        publishedAt : this.$( '#publishedAt' ).val() || undefined,
        assignedAt  : this.$( '#assignedAt' ).val() || undefined,
        completedAt : this.$( '#completedAt' ).val() || undefined,
        projectId   : null,
        state       : this.model.get( 'state' ),
        restrict    : this.model.get( 'restrict' ),
      };

      if (this.agency) {
        modelData.restrict.projectNetwork = view.$(  '#task-restrict-agency'  ).prop( 'checked' );
      }

      // README: Check if draft is being saved or if this is a submission.
      // If the state isn't a draft and it isn't simply being saved, then it will
      // be submitted for review. `event.saveState` is true if the task is not a
      // `draft` and assumes that the task is simply being updated rather than
      // there being a need to "Submit for Review".
      //
      if (event.draft) {
        modelData.state = 'draft';
        modelData.acceptingApplicants = true;
      } else if (!event.saveState) {
        modelData.state = 'submitted';
        modelData.acceptingApplicants = true;
      }

      if ( owner ) {
        modelData[ 'userId' ] = owner.id;
        modelData.owner = owner;
      }
      if ( completedBy !== '' ) {
        var timezoneOffset = (new Date()).getTimezoneOffset() * 60000;
        completedBy = new Date(completedBy);
        modelData[ 'completedBy' ] = new Date(completedBy.getTime() + timezoneOffset);
      }

      var tags = _( this.getTagsFromPage() )
        .chain()
        .map( function ( tag ) {
          if ( ! tag || ! tag.id ) { return; }
          return ( tag.id && tag.id !== tag.name ) ? parseInt( tag.id, 10 ) : {
            name: tag.name,
            type: tag.tagType,
            data: tag.data,
          };
        } )
        .compact()
        .value();

      modelData.tags = tags;

      this.options.model.trigger( 'task:update', modelData );
    } );
  },

  validateFields: function () {
    var tags      = [];
    var oldTags   = [];
    var diff      = [];

    // check all of the field validation before submitting
    var children = this.$el.find( '.validate' );
    var abort = false;

    _.each( children, function ( child ) {
      var iAbort = validate( { currentTarget: child } );
      abort = abort || iAbort;
    } );

    var completedBy = this.$('[name=task-time-required]:checked').attr('data-descr') == 'One time' ?  TaskFormViewHelper.getCompletedByDate() : null;
    if(completedBy) {
      var iAbort = false;
      try {
        iAbort = (new Date(completedBy).toISOString().split('T')[0]) !== completedBy;
      } catch (err) {
        iAbort = true;
      }
      if(iAbort) {
        $('#time-options-completion-date').addClass('usa-input-error');
        $('#time-options-completion-date input').toggleClass('usa-input-inline usa-input-inline-error');
        $('#time-options-completion-date > .field-validation-error').show();
      } else {
        $('#time-options-completion-date').removeClass('usa-input-error');
        $('#time-options-completion-date input').toggleClass('usa-input-inline-error usa-input-inline');
        $('#time-options-completion-date > .field-validation-error').hide();
      }
      abort = abort || iAbort;
    }

    return abort;
  },

  submit: function (e) {
    var abort = this.validateFields();
    if ( abort === true ) {
      return;
    }
    if($(e.currentTarget).data('state') == 'save') {
      return this.trigger( 'task:tags:save:done', { draft: true } );
    } else {
      return this.trigger( 'task:tags:save:done', { draft: false, saveState: false } );
    }
  },

  save: function ( e ) {
    if ( e.preventDefault ) { e.preventDefault(); }
    var abort = this.validateFields();
    if ( abort === true ) {
      return;
    }
    return this.trigger( 'task:tags:save:done', { draft: false, saveState: true } );
  },

  /*
   * Setup Time Options toggling
   */
  toggleTimeOptions: function (e) {
    TaskFormViewHelper.toggleTimeOptions(this);
  },

  displayChangeOwner: function (e) {
    e.preventDefault();
    this.$('.project-owner').hide();
    this.$('.change-project-owner').show();

    return this;
  },
  displayAddParticipant: function (e) {
    e.preventDefault();
    this.$('.project-no-people').hide();
    this.$('.add-participant').show();

    return this;
  },

  getTagsFromPage: function () {
    // Gather tags for submission after the task is created
    var tags = [];
    var taskTimeDescription = this.$('[name=task-time-required]:checked').attr('data-descr');
    var taskTimeTag = this.$('[name=task-time-required]:checked').val();

    if (taskTimeTag) {
      tags.push.apply(tags,[{
        id: parseInt(taskTimeTag),
        type: 'task-time-required',
      }]);
    }
    tags.push.apply(tags,this.$('#task_tag_skills').select2('data'));
    tags.push.apply(tags,this.$('#task_tag_location').select2('data'));
    tags.push.apply(tags,[this.$('#people').select2('data')]);
    if (taskTimeDescription === 'One time') {
      tags.push.apply(tags,[this.$('#time-required').select2('data')]);
    }
    if (taskTimeDescription === 'One time' || taskTimeDescription === 'Ongoing') {
      tags.push.apply(tags,[this.$('#time-estimate').select2('data')]);
    }
    if (taskTimeDescription === 'Ongoing') {
      tags.push.apply(tags,[this.$('#js-time-frequency-estimate').select2('data')]);
    }
    return tags;
  },

  getOldTags: function () {
    var oldTags = [];
    for (var i in this.options.tags) {
      oldTags.push({
        id: parseInt(this.options.tags[i].id),
        tagId: parseInt(this.options.tags[i].tag.id),
        type: this.options.tags[i].tag.type,
      });
    }
    return oldTags;
  },

  cleanup: function () {
    if (this.md) { this.md.cleanup(); }
    removeView(this);
  },
});

_.extend(TaskEditFormView.prototype, ShowMarkdownMixin);

module.exports = TaskEditFormView;
