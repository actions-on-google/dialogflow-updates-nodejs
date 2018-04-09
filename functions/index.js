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

const {
  dialogflow,
  BasicCard,
  Button,
  RegisterUpdate,
  Suggestions,
  UpdatePermission,
} = require('actions-on-google');
const admin = require('firebase-admin');
const functions = require('firebase-functions');

/** Dialogflow Parameters {@link https://dialogflow.com/docs/actions-and-parameters#parameters} */
const Parameters = {
  CATEGORY: 'category',
};

/** Collections and fields names in Firestore */
const FirestoreNames = {
  CATEGORY: 'category',
  CREATED_AT: 'created_at',
  INTENT: 'intent',
  TIP: 'tip',
  TIPS: 'tips',
  URL: 'url',
  USERS: 'users',
  USER_ID: 'userId',
};

/** App strings */
const RANDOM_CATEGORY = 'random';
const RECENT_TIP = 'most recent';
const TELL_LATEST_TIP_INTENT = 'tell_latest_tip';
const DAILY_NOTIFICATION_ASKED = 'daily_notification_asked';
const PUSH_NOTIFICATION_ASKED = 'push_notification_asked';

admin.initializeApp();
const db = admin.firestore();

const app = dialogflow({debug: true});

// Retrieve and tell a tip from the database.
app.intent('tell_tip', (conv, params) => {
  const category = params[Parameters.CATEGORY];
  let tipsRef = db.collection(FirestoreNames.TIPS);
  if (category !== RANDOM_CATEGORY) {
    tipsRef = tipsRef.where(FirestoreNames.CATEGORY, '==', category);
  }
  return tipsRef.get()
    .then((querySnapshot) => {
      const tips = querySnapshot.docs;
      const tipIndex = Math.floor(Math.random() * tips.length);
      const tip = tips[tipIndex];
      const screenOutput =
        conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
      if (!screenOutput) {
        return conv.close(tip.get(FirestoreNames.TIP));
      }
      conv.ask(tip.get(FirestoreNames.TIP));
      conv.ask(new BasicCard({
        text: tip.get(FirestoreNames.TIP),
        buttons: new Button({
          title: 'Learn More!',
          url: tip.get(FirestoreNames.URL),
        }),
      }));
      /**
       * We ask only once to show that this should be limited to avoid annoying
       * the user. In a real world app you want to be more sophisticated about
       * this, for example re-ask after a certain period of time or number of
       * interactions.
       */
      if (!conv.user.storage[DAILY_NOTIFICATION_ASKED]) {
        conv.ask(new Suggestions('Send daily'));
        conv.user.storage[DAILY_NOTIFICATION_ASKED] = true;
      }
    });
});

// Retrieve and tell the most recently added tip
app.intent('tell_latest_tip', (conv) => {
  return db.collection(FirestoreNames.TIPS)
    .orderBy(FirestoreNames.CREATED_AT, 'desc')
    .limit(1)
    .get()
    .then((querySnapshot) => {
      const tip = querySnapshot.docs[0];
      const screenOutput =
        conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
      if (!screenOutput) {
        return conv.close(tip.get(FirestoreNames.TIP));
      }
      conv.ask(tip.get(FirestoreNames.TIP));
      conv.ask(new BasicCard({
        text: tip.get(FirestoreNames.TIP),
        buttons: new Button({
          title: 'Learn More!',
          url: tip.get(FirestoreNames.URL),
        }),
      }));
      /**
       * We ask only once to show that this should be limited to avoid annoying
       * the user. In a real world app you want to be more sophisticated about
       * this, for example re-ask after a certain period of time or number of
       * interactions.
       */
      if (!conv.user.storage[PUSH_NOTIFICATION_ASKED]) {
        conv.ask(new Suggestions('Alert me of new tips'));
        conv.user.storage[PUSH_NOTIFICATION_ASKED] = true;
      }
    });
});

// Welcome message
app.intent('Default Welcome Intent', (conv) => {
  // get available categories to show in the welcome message and in the
  // suggestion chips.
  return db.collection(FirestoreNames.TIPS)
    .get()
    .then((querySnapshot) => {
      // create an array that contains only the unique values of categories
      const uniqueCategories = querySnapshot.docs.map((currentValue) => {
        return currentValue.get(FirestoreNames.CATEGORY);
      })
      .filter((element, index, array) => {
        return array.indexOf(element) === index;
      });
      uniqueCategories.unshift(RECENT_TIP);
      const welcomeMessage = `Hi! Welcome to Actions on Google Tips! ` +
        `I can offer you tips for Actions on Google. You can choose to ` +
        `hear the most recently added tip, or you can pick a category ` +
        `from ${uniqueCategories.join(', ')}, or I can tell you a tip ` +
        `from a randomly selected category.`;
      const screenOutput =
        conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
      if (!screenOutput) {
        return conv.ask(welcomeMessage);
      }
      uniqueCategories.push(RANDOM_CATEGORY);
      conv.ask(welcomeMessage);
      conv.ask(new Suggestions(uniqueCategories));
    });
});

// Start opt-in flow for push notifications
app.intent('setup_push', (conv) => {
  conv.ask(new UpdatePermission({intent: TELL_LATEST_TIP_INTENT}));
});

// Save intent and user id if user gave consent.
app.intent('finish_push_setup', (conv, params) => {
  if (conv.arguments.get('PERMISSION')) {
    const userID = conv.user.id;
    return db.collection(FirestoreNames.USERS)
      .add({
        [FirestoreNames.INTENT]: TELL_LATEST_TIP_INTENT,
        [FirestoreNames.USER_ID]: userID,
      })
      .then((docRef) => {
        conv.close(`Ok, I'll start alerting you.`);
      });
  } else {
    conv.close(`Ok, I won't alert you.`);
  }
});

// Start opt-in flow for daily updates
app.intent('setup_update', (conv, params) => {
  const category = params[Parameters.CATEGORY];
  conv.ask(new RegisterUpdate({
    intent: 'tell_tip',
    arguments: [{name: Parameters.CATEGORY, textValue: category}],
    frequency: 'DAILY',
  }));
});

// Confirm outcome of opt-in for daily updates.
app.intent('finish_update_setup', (conv, params, registered) => {
  if (registered && registered.status === 'OK') {
     conv.close(`Ok, I'll start giving you daily updates.`);
   } else {
    conv.close(`Ok, I won't give you daily updates.`);
   }
});

exports.aogTips = functions.https.onRequest(app);

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
        title: 'AoG tips latest tip',
      },
      target: {},
    };
    jwtClient.authorize((err, tokens) => {
      if (err) {
        throw new Error(`Auth error: ${err}`);
      }
      db.collection(FirestoreNames.USERS)
        .where(FirestoreNames.INTENT, '==', TELL_LATEST_TIP_INTENT)
        .get()
        .then((querySnapshot) => {
          querySnapshot.forEach((user) => {
            notification.target = {
              userId: user.get(FirestoreNames.USER_ID),
              intent: user.get(FirestoreNames.INTENT),
            };
            request.post('https://actions.googleapis.com/v2/conversations:send', {
              'auth': {
                'bearer': tokens.access_token,
              },
              'json': true,
              'body': {'customPushMessage': notification, 'isInSandbox': true},
            }, (err, httpResponse, body) => {
              if (err) {
                throw new Error(`API request error: ${err}`);
              }
              console.log(`${httpResponse.statusCode}: ` +
                `${httpResponse.statusMessage}`);
              console.log(JSON.stringify(body));
            });
          });
        })
        .catch((error) => {
          throw new Error(`Firestore query error: ${error}`);
        });
    });
    return 0;
  });

// Use this function to restore the content of the tips database.
exports.restoreTipsDB = functions.https.onRequest((request, response) => {
  db.collection(FirestoreNames.TIPS)
    .get()
    .then((querySnapshot) => {
      if (querySnapshot.size > 0) {
        let batch = db.batch();
        querySnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
        batch.commit()
          .then(addTips);
      }
    })
    .catch((error) => {
      throw new Error(`Firestore query error: ${error}`);
    });
  addTips();

  /**
   * Add tips
   */
  function addTips() {
    const tips = require('./tipsDB.json');
    let batch = db.batch();
    let tipsRef = db.collection(FirestoreNames.TIPS);
    tips.forEach((tip) => {
      let tipRef = tipsRef.doc();
      batch.set(tipRef, tip);
    });
    batch.commit()
      .then(() => {
        response.send(`Tips DB succesfully restored`);
      })
      .catch((error) => {
        throw new Error(`Error restoring tips DB: ${error}`);
      });
  }
});
