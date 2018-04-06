// Copyright 2018, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

process.env.DEBUG = 'actions-on-google:*';
const { DialogflowApp } = require('actions-on-google');
const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();
const db = admin.firestore();

/** Dialogflow Actions {@link https://dialogflow.com/docs/actions-and-parameters#actions} */
const Actions = {
  UNRECOGNIZED_DEEP_LINK: 'deeplink.unknown',
  TELL_TIP: 'tell.tip',
  TELL_LATEST_TIP: 'tell.latest.tip',
  FINISH_UPDATE_SETUP: 'finish.update.setup',
  WELCOME: 'input.welcome',
  SETUP_PUSH: 'setup.push',
  FINISH_PUSH_SETUP: 'finish.push.setup'
};
/** Dialogflow Parameters {@link https://dialogflow.com/docs/actions-and-parameters#parameters} */
const Parameters = {
  CATEGORY: 'category',
  UPDATE_INTENT: 'UPDATE_INTENT'
};

/** Collections and fields names in Firestore */
const FirestoreNames = {
  TIPS: 'tips',
  CATEGORY: 'category',
  TIP: 'tip',
  URL: 'url',
  CREATED_AT: 'created_at',
  USERS: 'users',
  INTENT: 'intent',
  USER_ID: 'userId'
};

/** App strings */
const RANDOM_CATEGORY = 'random';
const RECENT_TIP = 'most recent';
const TELL_LATEST_TIP_INTENT = 'tell_latest_tip';
const DAILY_NOTIFICATION_ASKED = 'daily_notification_asked';
const PUSH_NOTIFICATION_ASKED = 'push_notification_asked';

exports.aogTips = functions.https.onRequest((request, response) => {
  const app = new DialogflowApp({request, response});
  console.log('Request headers: ' + JSON.stringify(request.headers));
  console.log('Request body: ' + JSON.stringify(request.body));

  // Retrieve and tell a tip from the database.
  function tellTip (app) {
    const category = app.getArgument(Parameters.CATEGORY);
    let tipsRef = db.collection(FirestoreNames.TIPS);
    if (category !== RANDOM_CATEGORY) {
      tipsRef = tipsRef.where(FirestoreNames.CATEGORY, '==', category);
    }
    tipsRef.get()
      .then(function (querySnapshot) {
        const tips = querySnapshot.docs;
        const tipIndex = Math.floor(Math.random() * (tips.length - 0));
        const tip = tips[tipIndex];
        const screenOutput = app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT);
        if (!screenOutput) {
          return app.tell(tip.get(FirestoreNames.TIP));
        }
        const card = app.buildBasicCard(tip.get(FirestoreNames.TIP))
          .addButton('Learn More!', tip.get(FirestoreNames.URL));
        const richResponse = app.buildRichResponse()
          .addSimpleResponse(tip.get(FirestoreNames.TIP))
          .addBasicCard(card);
        /**
         * We ask only once to show that this should be limited to avoid annoying the user.
         * In a real world app you want to be more sophisticated about this, for example
         * re-ask after a certain period of time or number of interactions.
         */
        if (!app.userStorage[DAILY_NOTIFICATION_ASKED]) {
          richResponse.addSuggestions('Send daily');
          app.userStorage[DAILY_NOTIFICATION_ASKED] = true;
        }
        app.ask(richResponse);
      }).catch(function (error) {
        throw new Error(error);
      });
  }

  // Retrieve and tell the most recently added tip
  function tellLatestTip (app) {
    db.collection(FirestoreNames.TIPS)
      .orderBy(FirestoreNames.CREATED_AT, 'desc')
      .limit(1)
      .get()
      .then(function (querySnapshot) {
        const tip = querySnapshot.docs[0];
        const screenOutput = app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT);
        if (!screenOutput) {
          return app.tell(tip.get(FirestoreNames.TIP));
        }
        const card = app.buildBasicCard(tip.get(FirestoreNames.TIP))
          .addButton('Learn More!', tip.get(FirestoreNames.URL));
        const richResponse = app.buildRichResponse()
          .addSimpleResponse(tip.get(FirestoreNames.TIP))
          .addBasicCard(card);
        /**
         * We ask only once to show that this should be limited to avoid annoying the user.
         * In a real world app you want to be more sophisticated about this, for example
         * re-ask after a certain period of time or number of interactions.
         */
        if (!app.userStorage[PUSH_NOTIFICATION_ASKED]) {
          richResponse.addSuggestions('Alert me of new tips');
          app.userStorage[PUSH_NOTIFICATION_ASKED] = true;
        }
        app.ask(richResponse);
      }).catch(function (error) {
        throw new Error(error);
      });
  }

  // Welcome message
  function welcome (app) {
    // get available categories to show in the welcome message and in the suggestion chips.
    db.collection(FirestoreNames.TIPS)
      .get()
      .then(function (querySnapshot) {
        // create an array that contains only the unique values of categories
        const uniqueCategories = querySnapshot.docs.map(function (currentValue) {
          return currentValue.get(FirestoreNames.CATEGORY);
        })
        .filter(function (element, index, array) {
          return array.indexOf(element) === index;
        });
        uniqueCategories.unshift(RECENT_TIP);
        const welcomeMessage = `Hi! Welcome to Actions on Google Tips! I can offer you tips for ` +
            `Actions on Google. You can choose to hear the most recently added tip, or you can pick a ` +
            `category from ${uniqueCategories.join(', ')}, or I can tell you a tip from a randomly ` +
            `selected category.`;
        const screenOutput = app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT);
        if (!screenOutput) {
          return app.ask(welcomeMessage);
        }
        uniqueCategories.push(RANDOM_CATEGORY);
        const richResponse = app.buildRichResponse()
          .addSimpleResponse(welcomeMessage)
          .addSuggestions(uniqueCategories);
        app.ask(richResponse);
      })
      .catch(function (error) {
        throw new Error(error);
      });
  }

  // Confirm outcome of opt-in for daily updates.
  function finishUpdateSetup (app) {
    if (app.isUpdateRegistered()) {
      app.tell("Ok, I'll start giving you daily updates.");
    } else {
      app.tell("Ok, I won't give you daily updates.");
    }
  }

  // Start opt-in flow for push notifications
  function setupPush (app) {
    app.askForUpdatePermission(TELL_LATEST_TIP_INTENT);
  }

  // Save intent and user id if user gave consent.
  function finishPushSetup (app) {
    const userID = app.getArgument('UPDATES_USER_ID');
    if (app.isPermissionGranted()) {
      db.collection(FirestoreNames.USERS)
        .add({
          [FirestoreNames.INTENT]: TELL_LATEST_TIP_INTENT,
          [FirestoreNames.USER_ID]: userID
        })
        .then(function (docRef) {
          app.tell("Ok, I'll start alerting you");
        })
        .catch(function (error) {
          throw new Error(error);
        });
    } else {
      app.tell("Ok, I won't alert you");
    }
  }

  // Start opt-in flow for daily updates
  function configureUpdates (app) {
    const category = app.getArgument(Parameters.CATEGORY);
    app.askToRegisterDailyUpdate(
      'tell_tip',
      [{name: Parameters.CATEGORY, textValue: category}]
    );
  }

  // Map of action from Dialogflow to handling function
  const actionMap = new Map();
  actionMap.set(Actions.TELL_TIP, tellTip);
  actionMap.set(Actions.TELL_LATEST_TIP, tellLatestTip);
  actionMap.set(Actions.WELCOME, welcome);
  actionMap.set(app.StandardIntents.CONFIGURE_UPDATES, configureUpdates);
  actionMap.set(Actions.FINISH_UPDATE_SETUP, finishUpdateSetup);
  actionMap.set(Actions.SETUP_PUSH, setupPush);
  actionMap.set(Actions.FINISH_PUSH_SETUP, finishPushSetup);
  app.handleRequest(actionMap);
});

/**
 * Everytime a tip is added to the Firestore DB, this function runs and sends
 * notifications to the subscribed users.
 **/
exports.createTip = functions.firestore
  .document(`${FirestoreNames.TIPS}/{tipId}`)
  .onCreate((snap, context) => {
    const request = require('request');
    const google = require('googleapis');
    const serviceAccount = require('./service-account.json');
    const jwtClient = new google.auth.JWT(
      serviceAccount.client_email, null, serviceAccount.private_key,
      ['https://www.googleapis.com/auth/actions.fulfillment.conversation'],
      null
    );
    let notification = {
      userNotification: {
        title: 'AoG tips latest tip'
      },
      target: {}
    };
    jwtClient.authorize(function (err, tokens) {
      if (err) {
        throw new Error(`Auth error: ${err}`);
      }
      db.collection(FirestoreNames.USERS)
        .where(FirestoreNames.INTENT, '==', TELL_LATEST_TIP_INTENT)
        .get()
        .then(function (querySnapshot) {
          querySnapshot.forEach(function (user) {
            notification.target = {
              userId: user.get(FirestoreNames.USER_ID),
              intent: user.get(FirestoreNames.INTENT)
            };
            request.post('https://actions.googleapis.com/v2/conversations:send', {
              'auth': {
                'bearer': tokens.access_token
              },
              'json': true,
              'body': { 'customPushMessage': notification, 'isInSandbox': true }
            }, function (err, httpResponse, body) {
              if (err) {
                throw new Error(`API request error: ${err}`);
              }
              console.log(httpResponse.statusCode + ': ' + httpResponse.statusMessage);
              console.log(JSON.stringify(body));
            });
          });
        })
        .catch(function (error) {
          throw new Error(`Firestore query error: ${error}`);
        });
    });
    return 0;
  });

// Use this function to restore the content of the tips database.
exports.restoreTipsDB = functions.https.onRequest((request, response) => {
  db.collection(FirestoreNames.TIPS)
    .get()
    .then(function (querySnapshot) {
      if (querySnapshot.size > 0) {
        let batch = db.batch();
        querySnapshot.forEach(function (doc) {
          batch.delete(doc.ref);
        });
        batch.commit()
          .then(addTips);
      }
    })
    .catch(function (error) {
      throw new Error(`Firestore query error: ${error}`);
    });
  addTips();

  function addTips () {
    const tips = require('./tipsDB.json');
    let batch = db.batch();
    let tipsRef = db.collection(FirestoreNames.TIPS);
    tips.forEach(function (tip) {
      let tipRef = tipsRef.doc();
      batch.set(tipRef, tip);
    });
    batch.commit()
      .then(function () {
        response.send(`Tips DB succesfully restored`);
      })
      .catch(function (error) {
        throw new Error(`Error restoring tips DB: ${error}`);
      });
  }
});
