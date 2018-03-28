// adapted from https://discuss.prosemirror.net/t/using-with-react/904

import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { updateEditorState } from './modules/textEditor';
import { addHighlight } from './modules/resourceGrid';
import { schema } from 'prosemirror-schema-basic';
import { EditorState, Plugin, TextSelection } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';
import { addListNodes } from 'prosemirror-schema-list';
import { exampleSetup, buildMenuItems } from 'prosemirror-example-setup';
// import { toggleMark } from 'prosemirror-commands';
import { MenuItem } from 'prosemirror-menu';
import { Decoration, DecorationSet } from 'prosemirror-view';
import ProseMirrorEditorView from './ProseMirrorEditorView';

// const dmHighlightSpec = {
//   toDOM() { return ['span', {class: 'dm-highlight', style: 'background: red;', 'data-highlight-id': 'dm_text_highlight_1', onmouseover: "window.setFocusHighlight('dm_resource_1', 'dm_text_highlight_1')"}, 0]; }
// }

const dmSchema = new Schema({
  nodes: addListNodes(schema.spec.nodes, 'paragraph block*', 'block'),
  // marks: schema.spec.marks.addBefore('link', 'highlight', dmHighlightSpec)
});

class TextResource extends Component {
  // state: {editorState: EditorState};

  cmdItem(cmd, options) {
    let passedOptions = {
      label: options.title,
      run: cmd
    }
    for (let prop in options) passedOptions[prop] = options[prop]
    if ((!options.enable || options.enable === true) && !options.select)
      passedOptions[options.enable ? "enable" : "select"] = state => cmd(state)

    return new MenuItem(passedOptions)
  }

  setHighlight(pm, apply) {
    if (!apply) return true;
    let {empty, from, to} = pm.selection;
    if (empty) return true;
    this.props.addHighlight(this.props.resourceId, {from, to});
    return true;
  }

  constructor(props: TextResourceProps) {
    super(props);

    const {highlights, resourceId} = this.props;

    const dmPlugin = new Plugin({
      state: {
        init(_, {doc}) {
          const highlightKeys = Object.keys(highlights);
          const highlightDecorations = highlightKeys.map(highlightId => Decoration.inline(highlights[highlightId].target.from, highlights[highlightId].target.to, {style: 'background: yellow', onmouseover: `window.setFocusHighlight('${resourceId}', '${highlightId}')` }, {inclusiveStart: true, inclusiveEnd: true}));
          return DecorationSet.create(doc, highlightDecorations);
        },
        apply(tr, set) {
          return set.map(tr.mapping, tr.doc);
        }
      },
      props: {
        decorations(state) {
          return dmPlugin.getState(state);
        }
      }
    });

    // function markActive(state, type) {
    //   let {from, $from, to, empty} = state.selection
    //   if (empty) return type.isInSet(state.storedMarks || $from.marks())
    //   else return state.doc.rangeHasMark(from, to, type)
    // }
    // function markItem(markType, options) {
    //   let passedOptions = {
    //     active(state) { return markActive(state, markType) },
    //     enable: true
    //   }
    //   for (let prop in options) passedOptions[prop] = options[prop]
    //   return cmdItem(toggleMark(markType), passedOptions)
    // }
    const toggleHighlight = this.cmdItem(this.setHighlight.bind(this), {
      title: 'Toggle highlight',
      icon: {
        width: 60, height: 60,
        path: 'm12.32,59.74a1,1 0 0 0 1.32,0l33.3,-28.3l0,0l0,0l9.19,-9.19a13,13 0 0 0 -18.32,-18.44l-9.2,9.19l0,0l0,0l-28.38,34.36a1,1 0 0 0 0.1,1.37l11.99,11.01zm26.9,-54.52a11,11 0 1 1 15.56,15.56l-8.49,8.49l-2.47,-2.48l-2.47,-2.48l7.78,-7.78a1,1 0 0 0 0,-1.41l-4.24,-4.24a1,1 0 0 0 -1.41,0l-7.78,7.78l-2.48,-2.47l-2.48,-2.47l8.48,-8.5zm-5.66,21.22a2,2 0 0 1 -0.25,-0.31l0,-0.09a2,2 0 0 1 -0.14,-0.26l0,-0.07a2,2 0 0 1 -0.09,-0.3s0,-0.05 0,-0.08a2,2 0 0 1 0,-0.62s0,0 0,-0.07a2,2 0 0 1 0.09,-0.31l0,-0.07a2,2 0 0 1 0.14,-0.27l0,-0.08a2,2 0 0 1 0.25,-0.31l10.61,-10.6l2.83,2.83l-10.61,10.61a2,2 0 0 1 -2.83,0zm-4.17,-11.25l2.56,2.56l2.32,2.32l-2.12,2.12a4,4 0 0 0 -0.51,0.62l-0.07,0.13a4,4 0 0 0 -0.3,0.57l0,0.07a3.91,3.91 0 0 0 0,2.87l0,0.07a4,4 0 0 0 0.3,0.57l0.07,0.13a4,4 0 0 0 1.13,1.13l0.13,0.07a4,4 0 0 0 0.56,0.3l0.09,0a4,4 0 0 0 0.65,0.19l0,0a3.87,3.87 0 0 0 1.5,0l0,0a4,4 0 0 0 0.66,-0.19l0.09,0a4,4 0 0 0 0.57,-0.3l0.13,-0.07a4,4 0 0 0 0.62,-0.51l2.12,-2.12l2.35,2.35l2.54,2.54l-31.78,27.06l-10.62,-9.77l27.01,-32.71z'
      },
      active(state) { return false; },
      enable: true
    });
    const dmMenuContent = buildMenuItems(dmSchema).fullMenu;
    dmMenuContent.push([toggleHighlight]);

    const dmDoc = dmSchema.nodeFromJSON(JSON.parse(this.props.content));

    this.props.updateEditorState(resourceId, EditorState.create({
      // doc: dmSchema.node('doc', null, [
      //   dmSchema.node('paragraph', null, [dmSchema.text('One.', myMark)]),
      //   dmSchema.node('horizontal_rule'),
      //   dmSchema.node('paragraph', null, [dmSchema.text('Two! Here is some longer text, et cetera et cetera')]),
      //   dmSchema.node('paragraph', null, [dmSchema.text('Third paragraph hello hello hello')])
      // ]),
      doc: dmDoc,
      selection: TextSelection.create(dmDoc, 0),
      plugins: exampleSetup({
        schema: dmSchema,
        menuContent: dmMenuContent
      }).concat(dmPlugin)
    }));
  }

  dispatchTransaction = (tx: any) => {
    const editorState = this.props.editorStates[this.props.resourceId].apply(tx);
    this.props.updateEditorState(this.props.resourceId, editorState);
  }

  onEditorState = (editorState: EditorState) => {
    this.props.updateEditorState(this.props.resourceId, editorState);
  }

  render() {
    const editorState = this.props.editorStates[this.props.resourceId];
    if (!editorState) return null;
    return (
      <div>
        <div className="editorview-wrapper">
          <ProseMirrorEditorView
            ref={this.onEditorView}
            editorState={editorState}
            onEditorState={this.onEditorState}
          />
        </div>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  editorStates: state.textEditor.editorStates
});

const mapDispatchToProps = dispatch => bindActionCreators({
  updateEditorState,
  addHighlight
}, dispatch);

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TextResource);
