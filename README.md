# Actions on Google: Daily Updates and Push Notifications Sample

This sample demonstrates Actions on Google [user engagement](https://developers.google.com/assistant/engagement) features for use on Google Assistant including [daily updates](https://developers.google.com/assistant/engagement/daily) and [push notifications](https://developers.google.com/assistant/engagement/notifications) -- using the [Node.js client library](https://github.com/actions-on-google/actions-on-google-nodejs) and deployed on [Cloud Functions for Firebase](https://firebase.google.com/docs/functions/).


:warning: This code sample was built using Dialogflow. We now recommend using [Actions Builder or the Actions SDK](https://developers.google.com/assistant/conversational/overview) to develop, test, and deploy Conversational Actions.

## Setup Instructions
### Prerequisites
1. Node.js and NPM
    + We recommend installing using [NVM](https://github.com/creationix/nvm)
1. Install the [Firebase CLI](https://developers.google.com/assistant/actions/dialogflow/deploy-fulfillment)
    + We recommend using version 6.5.0, `npm install -g firebase-tools@6.5.0`
    + Run `firebase login` with your Google account

### Configuration
#### Actions Console
1. From the [Actions on Google Console](https://console.actions.google.com/), New project > **Create project** > under **More options** > **Conversational**
1. From the top menu under **Develop** > **Actions** (left nav) > **Add your first action** > **BUILD** (this will bring you to the Dialogflow console) > Select language and time zone > **CREATE**.
1. In the Dialogflow console, go to **Settings** ⚙ > **Export and Import** > **Restore from zip** using the `agent.zip` in this sample's directory.

#### Cloud Platform Console
1. In the [Google Cloud Platform console](https://console.cloud.google.com/), select your *Project ID* from the dropdown
1. From **Menu ☰** > **APIs & Services** > **Library** > select **Actions API** > **Enable**
1. Under **Menu ☰** > **APIs & Services** > **Credentials** > **Create Credentials** > **Service Account Key**.
1. From the dropdown, select **New Service Account**
    + name:  `service-account`
    + role:  **Project/Owner**
    + key type: **JSON** > **Create**
    + Your private JSON file will be downloaded to your local machine
1. Save private key as `service-account.json` in `functions/`

#### Daily Updates and Push Notifications
1. Back in the [Actions on Google console](https://console.actions.google.com) > under the top menu **Develop** > **Actions** (left nav):
1. Select the `tell_tip` intent > under **User engagement**:
    + **Enable** `Would you like to offer daily updates to users?`
    + Title: `advice Alert` > **Save**
1. Select the `tell_latest_tip` intent > under **User engagement**:
    + **Enable** `Would you like to send push notifications? If yes, user permission will be needed`
    + Title: `latest info Alert` > **Save**

#### Firestore Database
1. From the [Firebase console](https://console.firebase.google.com), find and select your Actions on Google Project ID
1. In the left navigation menu under **Develop** section > **Database** > **Create database** button > Select **Start in test mode** > **Enable**

#### Firebase Deployment
1. On your local machine, in the `functions` directory, run `npm install`
1. Run `firebase deploy --project {PROJECT_ID}` to deploy the function
    + To find your **Project ID**: In [Dialogflow console](https://console.dialogflow.com/) under **Settings** ⚙ > **General** tab > **Project ID**.

#### Dialogflow Console
1. Return to the [Dialogflow Console](https://console.dialogflow.com) > select **Fulfillment** > **Enable** Webhook > Set **URL** to the **Function URL** that was returned after the deploy command > **SAVE**.
    ```
    Function URL (aogTips): https://${REGION}-${PROJECT_ID}.cloudfunctions.net/aogTips
    ```
1. In a browser, go to `https://${REGION}-${PROJECT}.cloudfunctions.net/restoreTipsDB`, to add data to the Firestore database.
1. From the left navigation menu, click **Integrations** > **Integration Settings** under Google Assistant > Enable **Auto-preview changes** >  **Test** to open the Actions on Google simulator then say or type `Talk to my test app`.
    + To test daily updates, choose a category and below the tip, there will be a `Send daily` suggestion chip to subscribe for daily updates.
    + To test push notifications, choose `most recent` and below the tip, there will be an `Alert me of new tips` suggestion chip to subscribe for push notifications. Then you will need to add a tip to Firestore DB to receive the push notification.

#### Push Notifications Configuration
1. Then add a new tip to the Firestore Database to trigger a notification to the subscribed users. In the tips collection > select **Add document**:
    + Document ID: select **Auto ID**
    + field: `category`, type: string, value: `tools`
    + field: `created_at`, type: string, value: `2019-04-29T015:00:00.000Z` and modify value to current date/time
    + field: `tip`, type: string, value: `Here's the most recent info about tools`
    + field: `url`, type: string, value: `https://developers.google.com/actions/assistant/updates/notifications`

### Running this Sample
+ You can test your Action on any Google Assistant-enabled device on which the Assistant is signed into the same account used to create this project. Just say or type, “OK Google, talk to my test app”.
+ You can also use the Actions on Google Console simulator to test most features and preview on-device behavior.

### Troubleshooting
+ When testing on an iOS device, ensure that notifications are enabled for Assistant under settings.

## References & Issues
+ Questions? Go to [StackOverflow](https://stackoverflow.com/questions/tagged/actions-on-google), [Assistant Developer Community on Reddit](https://www.reddit.com/r/GoogleAssistantDev/) or [Support](https://developers.google.com/assistant/support).
+ For bugs, please report an issue on Github.
+ Actions on Google [Documentation](https://developers.google.com/assistant)
+ Actions on Google [Codelabs](https://codelabs.developers.google.com/?cat=Assistant)
+ [Webhook Boilerplate Template](https://github.com/actions-on-google/dialogflow-webhook-boilerplate-nodejs) for Actions on Google

## Make Contributions
Please read and follow the steps in the [CONTRIBUTING.md](CONTRIBUTING.md).

## License
See [LICENSE](LICENSE).

## Terms
Your use of this sample is subject to, and by using or downloading the sample files you agree to comply with, the [Google APIs Terms of Service](https://developers.google.com/terms/).
