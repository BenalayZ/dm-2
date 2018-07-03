import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Dialog from 'material-ui/Dialog';
import TextField from 'material-ui/TextField';
import FlatButton from 'material-ui/FlatButton';
import { red500, blue900 } from 'material-ui/styles/colors';
import { registerUser, signInUser } from './modules/redux-token-auth-config';
import { load, hideLogin, hideRegistration, showApprovalPending, hideApprovalPending, userEmailChanged, userNameChanged, userPasswordChanged, userPasswordConfirmationChanged, userAuthErrored } from './modules/home';

class LoginRegistrationDialog extends Component {
  render() {
    let title = '';
    let actions = [];
    let open = false;
    let requestedClose = () => {};
    let showNameField = false;
    let showEmailField = false;
    let showPasswordField = false;
    let showPasswordConfirmationField = false;

    if (this.props.registrationShown) {
      title = 'Register new user';
      actions.push(
        <FlatButton
          label='Cancel'
          primary={true}
          onClick={this.props.hideRegistration}
        />
      );
      actions.push(
        <FlatButton
          label='Register'
          primary={true}
          onClick={() => {
            this.props.registerUser({
              email: this.props.userEmail,
              name: this.props.userName,
              password: this.props.userPassword,
              password_confirmation: this.props.userPasswordConfirmation
            })
            .then(this.props.showApprovalPending)
            .catch(this.props.userAuthErrored);
          }}
        />
      );
      open = true;
      requestedClose = this.props.hideRegistration;
      showNameField = true;
      showEmailField = true;
      showPasswordField = true;
      showPasswordConfirmationField = true;
    }
    else if (this.props.approvalPendingShown) {
      title = 'Approval pending';
      actions.push(
        <FlatButton
          label='OK'
          primary={true}
          onClick={this.props.hideApprovalPending}
        />
      );
      open = true;
      requestedClose = this.props.hideApprovalPending;
    }
    else if (this.props.loginShown) {
      title = 'Sign in';
      actions.push(
        <FlatButton
          label='Cancel'
          primary={true}
          onClick={this.props.hideLogin}
        />
      );
      actions.push(
        <FlatButton
          label='Sign in'
          primary={true}
          onClick={() => {
            this.props.signInUser({
              email: this.props.userEmail,
              password: this.props.userPassword
            })
            .then(() => {
              this.props.hideLogin();
              this.props.load();
            })
            .catch(this.props.userAuthErrored);
          }}
        />
      );
      open = true;
      requestedClose = this.props.hideLogin;
      showNameField = false;
      showEmailField = true;
      showPasswordField = true;
    }

    return (
      <Dialog
        title={title}
        modal={false}
        open={open}
        onRequestClose={requestedClose}
        autoScrollBodyContent={true}
        actions={actions}
      >
        {this.props.userAuthError &&
          <p style={{ color: red500 }}>User authentication error</p>
        }
        {this.props.approvalPendingShown &&
          <p style={{ color: blue900 }}>Your account has been created, but a site administrator must approve it before you can proceed to work with projects. An email has been sent to the administrators for this site.</p>
        }
        {showEmailField &&
          <div>
            <TextField
              floatingLabelText='Email'
              hintText='me@example.com'
              value={this.props.userEmail}
              onChange={this.props.userEmailChanged}
            /><br />
          </div>
        }
        {showNameField &&
          <div>
            <TextField
              floatingLabelText='Display name'
              value={this.props.userName}
              onChange={this.props.userNameChanged}
            /><br />
          </div>
        }
        {showPasswordField &&
          <div>
            <TextField
              type='password'
              floatingLabelText='Password'
              value={this.props.userPassword}
              onChange={this.props.userPasswordChanged}
            /><br />
          </div>
        }
        {showPasswordConfirmationField &&
          <div>
            <TextField
              type='password'
              floatingLabelText='Confirm password'
              value={this.props.userPasswordConfirmation}
              onChange={this.props.userPasswordConfirmationChanged}
              errorText={this.props.userPassword !== this.props.userPasswordConfirmation ? 'Passwords much match' : null}
            /><br />
          </div>
        }
      </Dialog>
    );
  }
}

const mapStateToProps = state => ({
  loginShown: state.home.loginShown,
  registrationShown: state.home.registrationShown,
  approvalPendingShown: state.home.approvalPendingShown,
  userEmail: state.home.userEmail,
  userName: state.home.userName,
  userPassword: state.home.userPassword,
  userPasswordConfirmation: state.home.userPasswordConfirmation,
  userAuthError: state.home.userAuthError
});

const mapDispatchToProps = dispatch => bindActionCreators({
  load,
  hideLogin,
  hideRegistration,
  showApprovalPending,
  hideApprovalPending,
  userEmailChanged,
  userNameChanged,
  userPasswordChanged,
  userPasswordConfirmationChanged,
  registerUser,
  signInUser,
  userAuthErrored
}, dispatch);

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LoginRegistrationDialog);
