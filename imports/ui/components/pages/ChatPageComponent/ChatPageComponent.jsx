import { Meteor } from 'meteor/meteor';
import React from 'react';
import { If, Then, Else } from 'react-if';

import { ANSWERED_STATUS, CANCELED_STATUS } from '/imports/api/collections/messages';

import { ChatContainer } from '/imports/ui/containers/parts/chat/ChatContainer';
import { ChatSidebarComponent } from '/imports/ui/components/parts/chat/ChatSidebarComponent/ChatSidebarComponent';

const defaultCallState = {
  peer: null,
  stream: null,
  call: null,
  userPeerId: null,
  contactPeerId: null,
  callMessageId: null,
};

export const ChatPageComponent = React.createClass({
  propTypes: {
    user: React.PropTypes.object.isRequired,
    hasContact: React.PropTypes.bool.isRequired,
    contact: React.PropTypes.object,
    messages: React.PropTypes.array.isRequired
  },
  getInitialState: function () {
    return {
      ...defaultCallState,
      isHangingUp: false,
    }
  },
  resetVideoCallState: function () {
    this.setState(defaultCallState);
  },
  render: function () {
    return (
      <div>
        <If condition={this.props.hasContact}>
          <Then>
            <div>
              <ChatContainer
                messages={this.props.messages}
                contact={this.props.contact}
                currentCall={this.state.call !== null}
                startVideoCall={this.startVideoCall}
                stopVideoCall={this.stopVideoCall}
                onAnswer={this.onAnswer}
                onDecline={this.onDecline}
                onHangUp={this.onHangUp}
                onCancel={this.onCancel}
              />
              <ChatSidebarComponent
                user={this.props.user}
                contact={this.props.contact}
                stream={this.state.stream}
                call={this.state.call}
              />
            </div>
          </Then>
          <Else>
            <p>404</p>
          </Else>
        </If>
      </div>
    );
  },
  startVideoCall: function () {
    if (!this.props.contact.status.online) {
      toastr.error(`${this.props.contact.username} is offline.`, 'Error');
      return false;
    }

    this.getUserStream((err, stream) => {
      if (err) {
        toastr.error('Webcam must be allowed to make a video call.', 'Error');
      } else {
        this.setState({
          stream
        });

        this.initPeer(userPeerId => {
          if (userPeerId) {
            Meteor.call('startVideoCall', userPeerId, this.props.contact._id, (err, callMessageId) => {
              if (err) {
                toastr.error(err.reason, 'Error');
              } else {
                this.setState({
                  callMessageId
                });
              }
            });
          } else {
            toastr.error('Unable to connect to the server.', 'Error');
          }
        });
      }
    });
  },
  getUserStream: function (onStream) {
    navigator.getUserMedia({ audio: true, video: true }, stream => {
      onStream(null, stream);
    }, err => {
      onStream(err);
    });
  },
  initPeer: function (onOpen) {
    const peer = new Peer({
      host: Meteor.settings.public.peer.host,
      port: Meteor.settings.public.peer.port,
      path: Meteor.settings.public.peer.path
    });

    peer.on('open', userPeerId => {
      this.setState({
        userPeerId
      });

      onOpen(userPeerId);
    });

    peer.on('call', call => {
      call.answer(this.state.stream);
      this.listenToConnections();

      this.setState({
        call
      });
    });

    peer.on('error', err => {
      console.log('peer error', err);
    });

    peer.on('close', () => {
      console.log('peer close');
    });

    peer.on('disconnected', () => {
      console.log('peer disconnected');
    });

    this.setState({
      peer
    });
  },
  stopPeer: function () {
    if (this.state.peer) {
      this.setState({
        isHangingUp: true
      }, () => {
        if (this.state.call) {
          this.state.call.close();
        }

        if (this.state.stream) {
          this.state.stream.stop();
        }

        this.state.peer.destroy();
        this.resetVideoCallState();
      });
    }
  },
  onAnswer: function (message) {
    this.getUserStream((err, stream) => {
      if (err) {
        toastr.error('Webcam must be allowed to make a video call.', 'Error');
      } else {
        this.setState({
          stream
        });

        this.initPeer(userPeerId => {
          if (userPeerId) {
            Meteor.call('updateVideoCallStatus', message._id, ANSWERED_STATUS, err => {
              if (err) {
                toastr.error(err.reason, 'Error');
              } else {
                this.setState({
                  contactPeerId: message.contactVideoPeerId,
                  call: this.state.peer.call(message.contactVideoPeerId, stream),
                  callMessageId: message._id,
                }, () => {
                  this.listenToConnections();
                });
              }
            });
          } else {
            toastr.error('Unable to connect to the server.', 'Error');
          }
        });
      }
    });
  },
  onDecline: function (message) {
    Meteor.call('setVideoCallDeclined', message._id, err => {
      if (err) {
        toastr.error(err.reason, 'Error');
      }
    });

    this.stopPeer();
  },
  onHangUp: function (message) {
    Meteor.call('setVideoCallHungUp', message._id, err => {
      if (err) {
        toastr.error(err.reason, 'Error');
      }
    });

    this.stopPeer();
  },
  onCancel: function (message) {
    Meteor.call('updateVideoCallStatus', message._id, CANCELED_STATUS, err => {
      if (err) {
        toastr.error(err.reason, 'Error');
      }
    });

    this.stopPeer();
  },
  stopVideoCall: function () {
    Meteor.call('updateVideoCallStatusHungUp', this.state.callMessageId, err => {
      if (err) {
        toastr.error(err.reason, 'Error');
      }
    });

    this.stopPeer();
  },
  listenToConnections: function () {
    _.each(this.state.peer.connections, connections => {
      connections.forEach(connection => {
        connection.on('close', () => {
          if (this.state.isHangingUp) {
            this.setState({
              isHangingUp: false
            });
          } else {
            this.onConnectionLost();
          }
        });
      });
    });
  },
  onConnectionLost: function () {
    Meteor.call('updateVideoCallStatusConnectionLost', this.state.callMessageId, err => {
      if (err) {
        toastr.error(err.reason, 'Error');
      }
    });

    this.stopPeer();
  },
});