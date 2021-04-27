/*
 * Copyright (c) 2016-present, Parse, LLC
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */
import * as Filters from 'lib/Filters';
import Button from 'components/Button/Button.react';
import Icon from 'components/Icon/Icon.react';
import Popover from 'components/Popover/Popover.react';
import Position from 'lib/Position';
import React from 'react';
import ReactDOM from 'react-dom';
import styles from 'components/BrowserFilter/BrowserFilter.scss';
import TextInput from 'components/TextInput/TextInput.react'
import { List, Map } from 'immutable';

const POPOVER_CONTENT_ID = 'browserFilterPopover';

export default class BrowserQuery extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false,
      filters: new List(),
      blacklistedFilters: Filters.BLACKLISTED_FILTERS.concat(props.blacklistedFilters),
      query: ''
    };
    this.toggle = this.toggle.bind(this);
  }

  componentDidMount() {
    this.node = ReactDOM.findDOMNode(this);
    document.addEventListener('keydown', this.keydownHandler(this))
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.keydownHandler(this));
  }

  componentWillReceiveProps(props) {
    if (props.className !== this.props.className) {
      this.setState({ open: false });
    }
  }

  filtersToQuery() {
    const stringifiedQuery = this.props.filters
      .map(filter => [
        filter.get('field'),
        filter.get('constraint'),
        filter.get('compareTo')
      ].join(' ')
      ).join('\n')
    this.updateQuery(stringifiedQuery)
  }

  toggle() {
    let filters = this.props.filters;
    if (this.props.filters.size === 0) {
      let available = Filters.availableFilters(this.props.schema, null, this.state.blacklistedFilters);
      let field = Object.keys(available)[0];
      filters = new List([
        new Map({ field: field, constraint: available[field][0] })
      ]);
    }
    this.setState(prevState => ({
      open: !prevState.open,
      filters: filters
    }));
    this.props.setCurrent(null);
    if (!this.state.open) {
      this.filtersToQuery()
    }
  }

  clear() {
    this.props.onChange(new Map());
    this.updateQuery('')
  }

  compileQuery() {
    console.log(this.props.schema)
    const schemas = this.props.schema
    const available = Filters.availableFilters(this.props.schema, this.state.filters, this.state.blacklistedFilters);

    const query = this.state.query
    const rows = query.split('\n').filter(Boolean)

    const formatCompareTo = (field, compareTo) => {
      const { type, targetClass } = schemas[field]

      if (type === 'Date') {
        return { __type: type, iso: new Date(compareTo).toISOString() }
      }

      if (type === 'Pointer') {
        return { className: targetClass, __type: type, objectId: compareTo }
      }

      return compareTo
    }

    const compileRow = ([field, constraint, ...compareTo]) => ({
      field,
      constraint,
      compareTo: formatCompareTo(field, compareTo.join(' '))
    })

    const stringQueries = rows.map(row => row.split(' ')).map(compileRow)
    stringQueries.forEach(x => console.log(x))

    const invalidRows = stringQueries.filter(({ field, constraint }) => !available[field].includes(constraint))

    if (invalidRows.length) {
      invalidRows.forEach(({ field, constraint }) => console.log(`${field} does not have constraint ${constraint}, available constraints are ${available[field]}`))
      return
    }

    const immutableFilters = new List(stringQueries.map(obj => new Map(obj)))

    let field = Object.keys(available)[0]
    Object.keys(available).map(key => console.log(key, available[key]))

    this.props.onChange(immutableFilters)
    // make sure all the filters are LEGIT
    // this.setState({ filters })
  }

  updateQuery(query) {
    this.setState({ query })
  }

  apply() {
    this.compileQuery();
  }

  keydownHandler(self) {
    return (e) => {
      if (e.keyCode === 13 && e.ctrlKey) // Ctrl + Enter
        self.compileQuery();
    }
  }

  render() {
    let popover = null;
    let buttonStyle = [styles.entry];

    if (this.state.open) {
      let position = Position.inDocument(this.node);
      let popoverStyle = [styles.popover];
      buttonStyle.push(styles.title);

      if (this.props.filters.size) {
        popoverStyle.push(styles.active);
      }
      popover = (
        <Popover fixed={true} position={position} onExternalClick={this.toggle} contentId={POPOVER_CONTENT_ID}>
          <div className={popoverStyle.join(' ')} onClick={() => this.props.setCurrent(null)} id={POPOVER_CONTENT_ID}>
            <div onClick={this.toggle} style={{ cursor: 'pointer', width: this.node.clientWidth, height: this.node.clientHeight }}></div>
            <div className={styles.body}>
              <TextInput
                height={200}
                placeholder='Enter query. Ctrl + Enter to run.'
                multiline={true}
                onChange={this.updateQuery.bind(this)}
                value={this.state.query}
              />
              <div className={styles.footer}>
                <Button
                  color="white"
                  primary={true}
                  value="Apply"
                  width="256px"
                  onClick={this.apply.bind(this)}
                />
                <Button
                  color="red"
                  primary={true}
                  value="Clear"
                  width="256px"
                  onClick={this.clear.bind(this)}
                />
              </div>
            </div>
          </div>
        </Popover>
      );
    }
    if (this.props.filters.size) {
      buttonStyle.push(styles.active);
    }
    return (
      <div className={styles.wrap}>
        <div className={buttonStyle.join(' ')} onClick={this.toggle}>
          <Icon name="filter-solid" width={14} height={14} />
          <span>{this.props.filters.size ? 'Queried' : 'Query'}</span>
        </div>
        {popover}
      </div>
    );
  }
}
