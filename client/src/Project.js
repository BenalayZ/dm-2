import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import HTML5Backend from 'react-dnd-html5-backend';
import { DragDropContext } from 'react-dnd';
import { loadProject, updateProject, showSettings, hideSettings, setSidebarIsDragging, setSidebarWidth } from './modules/project';
import { selectTarget, closeTarget, promoteTarget } from './modules/annotationViewer';
import { closeDeleteDialog, confirmDeleteDialog } from './modules/documentGrid';
import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import Drawer from 'material-ui/Drawer';
import Navigation from './Navigation';
import ProjectSettingsDialog from './ProjectSettingsDialog';
import ProjectSidebar from './ProjectSidebar';
import DocumentViewer from './DocumentViewer';
import LinkInspectorPopupLayer from './LinkInspectorPopupLayer';
import SearchResultsPopupLayer from './SearchResultsPopupLayer';

class Project extends Component {
  constructor(props) {
    super(props);

    this.mainContainer = null;
    this.mouseX = 0;
    this.mouseY = 0;
  }

  setFocusHighlight(document_id, highlight_id) {
    if (window.highlightFocusTimeout) window.clearTimeout(window.highlightFocusTimeout);
    const resource = this.props.openDocuments.find(resource => resource.id.toString() === document_id.toString());
    const target = resource && highlight_id ? resource.highlight_map[highlight_id] : resource;
    if (target) {
      target.document_id = document_id;
      target.highlight_id = highlight_id ? target.id : null;
      target.document_title = resource.title;
      target.document_kind = resource.document_kind;
      target.startPosition = {
        x: Math.min(Math.max(this.mouseX - this.props.sidebarWidth - 150, 0), this.mainContainer.offsetWidth - 300),
        y: this.mouseY + window.scrollY - 52
      };
      window.highlightFocusTimeout = window.setTimeout(() => {
        this.props.selectTarget(target);
      }, 10);
    }
  }

  componentDidMount() {
    window.setFocusHighlight = this.setFocusHighlight.bind(this);
    if (this.props.match.params.slug !== 'new') {
      this.props.loadProject(this.props.match.params.slug, this.props.projectTitle)
    }
  }

  renderDeleteDialog() {
    const { deleteDialogTitle, closeDeleteDialog, deleteDialogSubmit, deleteDialogOpen, deleteDialogBody } = this.props;

    return (
      <Dialog
        title={deleteDialogTitle}
        actions={[
          <FlatButton label='Cancel' primary={true} onClick={closeDeleteDialog} />,
          <FlatButton label={deleteDialogSubmit} primary={true} onClick={confirmDeleteDialog} />
        ]}
        modal={true}
        open={deleteDialogOpen}
      >
        {deleteDialogBody}
      </Dialog>
    );
  }

  renderDialogLayers() {
    return (
      <div>
        <LinkInspectorPopupLayer 
          targets={this.props.selectedTargets} 
          closeHandler={this.props.closeTarget} 
          mouseDownHandler={this.props.promoteTarget} 
          openDocumentIds={this.props.openDocumentIds} 
          writeEnabled={this.props.writeEnabled} 
          sidebarWidth={this.props.sidebarWidth} 
        />
        <SearchResultsPopupLayer 
          openDocumentIds={this.props.openDocumentIds} 
          sidebarWidth={this.props.sidebarWidth} 
        />
        { this.renderDeleteDialog() }
        <ProjectSettingsDialog />
      </div>
    );
  }

  renderDocumentGrid() {
    const gridInnerStyle = { 
      margin: `72px 8px 0 ${this.props.sidebarWidth + 8}px`, 
      display: 'flex', 
      flexWrap: 'wrap', 
      overflow: 'hidden' 
    }

    return (
      <div
        id='document-grid-main'
        ref={el => {this.mainContainer = el;}}
        onMouseMove={event => {this.mouseX = event.clientX; this.mouseY = event.clientY;}}
      >          
        <div id='document-grid-inner' style={gridInnerStyle}>
          {this.props.openDocuments.map((document, index) => (
            <DocumentViewer 
              key={`${document.id}-${document.timeOpened}`} 
              index={index} 
              document_id={document.id}  
              timeOpened={document.timeOpened} 
              resourceName={document.title} 
              document_kind={document.document_kind} 
              content={document.content} 
              highlight_map={document.highlight_map} 
              image_thumbnail_urls={document.image_thumbnail_urls} 
              image_urls={document.image_urls} 
              linkInspectorAnchorClick={() => {this.setFocusHighlight(document.id);}} 
              writeEnabled={this.props.writeEnabled} 
              locked={document.locked}
              lockedByUserName={document.locked_by_user_name}
              lockedByMe={document.locked_by_me}
            />
          ))}
        </div>
      </div>
    );
  }

  render() {
    return (
      <div>
        <Navigation
          title={this.props.title}
          inputId={this.props.projectId}
          onTitleChange={(event, newValue) => {this.props.updateProject(this.props.projectId, {title: newValue});}}
          isLoading={this.props.loading}
          showSettings={this.props.adminEnabled}
          settingsClick={this.props.showSettings}
        />
        <Drawer docked={true} open={true} width={this.props.sidebarWidth}>
          <ProjectSidebar sidebarTarget={this.props.sidebarTarget} contentsChildren={this.props.contentsChildren} openDocumentIds={this.props.openDocumentIds} writeEnabled={this.props.writeEnabled} />
        </Drawer>
        { this.renderDialogLayers() }
        { this.renderDocumentGrid() }
      </div>
    );
  }
}

const mapStateToProps = state => ({
  currentUser:        state.reduxTokenAuth.currentUser,
  projectId:          state.project.id,
  title:              state.project.title,
  loading:            state.project.loading,
  errored:            state.project.errored,
  adminUsers:         state.project.adminUsers,
  contentsChildren:   state.project.contentsChildren,
  sidebarWidth:       state.project.sidebarWidth,
  sidebarIsDragging:  state.project.sidebarIsDragging,
  writeEnabled:       state.project.currentUserPermissions.write,
  adminEnabled:       state.project.currentUserPermissions.admin,
  openDocuments:      state.documentGrid.openDocuments,
  openDocumentIds:    state.documentGrid.openDocuments.map(document => document.id.toString()),
  deleteDialogOpen:   state.documentGrid.deleteDialogOpen,
  deleteDialogTitle:  state.documentGrid.deleteDialogTitle,
  deleteDialogBody:   state.documentGrid.deleteDialogBody,
  deleteDialogSubmit: state.documentGrid.deleteDialogSubmit,
  selectedTargets:    state.annotationViewer.selectedTargets,
  sidebarTarget:      state.annotationViewer.sidebarTarget
});

const mapDispatchToProps = dispatch => bindActionCreators({
  loadProject,
  updateProject,
  selectTarget,
  closeTarget,
  promoteTarget,
  closeDeleteDialog,
  confirmDeleteDialog,
  showSettings,
  hideSettings,
  setSidebarIsDragging,
  setSidebarWidth
}, dispatch);

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DragDropContext(HTML5Backend)(Project));
