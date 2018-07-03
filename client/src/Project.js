import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import HTML5Backend from 'react-dnd-html5-backend';
import { DragDropContext } from 'react-dnd';
import SplitPane from 'react-split-pane';
import { loadProject, updateProject, mouseMove, showSettings, hideSettings } from './modules/project';
import { selectTarget, closeTarget, promoteTarget } from './modules/annotationViewer';
import { closeDeleteDialog, confirmDeleteDialog } from './modules/documentGrid';
import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import Navigation from './Navigation';
import ProjectSettingsDialog from './ProjectSettingsDialog';
import ProjectSidebar from './ProjectSidebar';
import DocumentViewer from './DocumentViewer';
import LinkInspectorPopupLayer from './LinkInspectorPopupLayer';

class Project extends Component {
  constructor(props) {
    super(props);

    this.mainContainer = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.sidebarWidth = 350;
  }

  setFocusHighlight(document_id, highlight_id) {
    const resource = this.props.openDocuments.find(resource => resource.id.toString() === document_id.toString());
    const target = resource && highlight_id ? resource.highlight_map[highlight_id] : resource;
    if (target) {
      target.document_id = document_id;
      target.highlight_id = highlight_id ? target.id : null;
      target.document_title = resource.title;
      target.document_kind = resource.document_kind;
      target.startPosition = {
        x: Math.min(Math.max(this.mouseX - this.sidebarWidth - 150, 0), this.mainContainer.offsetWidth - 300),
        y: this.mouseY + window.scrollY + 12
      };
      this.props.selectTarget(target);
    }
  }

  componentDidMount() {
    window.setFocusHighlight = this.setFocusHighlight.bind(this);
    if (this.props.match.params.slug !== 'new') {
      this.props.loadProject(this.props.match.params.slug, this.props.projectTitle)
    }
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
        <SplitPane split='vertical' minSize={250} maxSize={600} defaultSize={this.sidebarWidth} onChange={size => {this.sidebarWidth = size;}}>
          <ProjectSidebar sidebarTarget={this.props.sidebarTarget} contentsChildren={this.props.contentsChildren} openDocumentIds={this.props.openDocumentIds} writeEnabled={this.props.writeEnabled} />
          <div
            style={{ height: '100%' }}
            ref={el => {this.mainContainer = el;}}
            onMouseMove={event => {this.mouseX = event.clientX; this.mouseY = event.clientY;}}
          >
            <div style={{ margin: '80px 16px 16px 16px', display: 'grid', gridTemplateRows: '500px 500px', gridTemplateColumns: '1fr 1fr', gridGap: '20px' }}>
              {this.props.openDocuments.map(document => (
                <DocumentViewer key={document.id} document_id={document.id} resourceName={document.title} document_kind={document.document_kind} content={document.content} highlight_map={document.highlight_map} image_thumbnail_urls={document.image_thumbnail_urls} image_urls={document.image_urls} linkInspectorAnchorClick={() => {this.setFocusHighlight(document.id);}} writeEnabled={this.props.writeEnabled} />
              ))}
            </div>
            <LinkInspectorPopupLayer targets={this.props.selectedTargets} closeHandler={this.props.closeTarget} mouseDownHandler={this.props.promoteTarget} openDocumentIds={this.props.openDocumentIds} writeEnabled={this.props.writeEnabled} />
          </div>
        </SplitPane>
        <Dialog
          title={this.props.deleteDialogTitle}
          actions={[
            <FlatButton label='Cancel' primary={true} onClick={this.props.closeDeleteDialog} />,
            <FlatButton label={this.props.deleteDialogSubmit} primary={true} onClick={this.props.confirmDeleteDialog} />
          ]}
          modal={true}
          open={this.props.deleteDialogOpen}
        >
          {this.props.deleteDialogBody}
        </Dialog>
        <ProjectSettingsDialog />
      </div>
    );
  }
}

const mapStateToProps = state => ({
  currentUser: state.reduxTokenAuth.currentUser,
  writeEnabled: state.project.currentUserPermissions.write,
  adminEnabled: state.project.currentUserPermissions.admin,
  projectId: state.project.id,
  title: state.project.title,
  loading: state.project.loading,
  errored: state.project.errored,
  contentsChildren: state.project.contentsChildren,
  adminUsers: state.project.adminUsers,
  openDocuments: state.documentGrid.openDocuments,
  openDocumentIds: state.documentGrid.openDocuments.map(document => document.id.toString()),
  selectedTargets: state.annotationViewer.selectedTargets,
  sidebarTarget: state.annotationViewer.sidebarTarget,
  deleteDialogOpen: state.documentGrid.deleteDialogOpen,
  deleteDialogTitle: state.documentGrid.deleteDialogTitle,
  deleteDialogBody: state.documentGrid.deleteDialogBody,
  deleteDialogSubmit: state.documentGrid.deleteDialogSubmit
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
  hideSettings
}, dispatch);

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DragDropContext(HTML5Backend)(Project));
