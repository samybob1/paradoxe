import { Meteor } from 'meteor/meteor';
import escapeStringRegExp from 'escape-string-regexp';

import { findUserByLoginToken } from '/imports/api/collections/users';

Picker.route('/users/search', function (params, req, res) {
  // Required headers
  const userId = req.headers['x-user-id'];
  const loginToken = req.headers['x-login-token'];

  if (!userId || !loginToken) {
    fail(res);
    return false;
  }

  // Connected user
  const user = findUserByLoginToken(userId, loginToken, {
    fields: {
      'profile.contacts': 1
    }
  });

  if (!user) {
    fail(res);
    return false;
  }

  // Exclude bot, connected user and his contacts
  const excludeIds = user.profile && user.profile.contacts
    ? user.profile.contacts
    : [];

  excludeIds.push(Meteor.settings.public.bot.id);
  excludeIds.push(userId);

  // Find users
  const users = Meteor.users.find({
    _id: {
      $nin: excludeIds
    },
    username: {
      $regex: escapeStringRegExp(params.query.username)
    }
  }, {
    fields: {
      username: 1
    },
    limit: 20
  }).fetch();

  // Return results
  res.end(JSON.stringify({
    success: true,
    results: users.map(user => ({
      name: user.username,
      value: user.username
    }))
  }));
});

function fail(res) {
  res.end(JSON.stringify({
    success: false,
    message: 'You have to be logged in.'
  }));
}
