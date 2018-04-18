import React, { Component } from 'react';
import TableOfContents from './TableOfContents';

export default class ProjectSidebar extends Component {
  render() {
    return (
      <div style={{backgroundColor: 'white', height: '100%', paddingTop: '72px'}}>
        <TableOfContents contentsChildren={this.props.contentsChildren} />
      </div>
    );
  }
}
