import { browserHistory } from 'react-router';

import Notifications from 'react-notification-system-redux';

export function feedback(feedbackAttributes) {
  return dispatch => {
    Meteor.call('feedback', feedbackAttributes, err => {
      if (err) {
        dispatch(
          Notifications.error({
            title: `An error occurred`,
            message: err.reason,
            position: 'tr',
            autoDismiss: 5,
            dismissible: true
          })
        );
      }
      else {
        dispatch(
          Notifications.success({
            title: `Your feedback was sent`,
            message: `Thank you, your opinion is important to us.`,
            position: 'tr',
            autoDismiss: 5,
            dismissible: true
          })
        );
        browserHistory.push('/posts');
      }
    });
  };
}

