const emailQueue = require("./emailQueue");
const { sendEmailNotificationReminder } = require("./sendMail");
require("dotenv").config();

emailQueue.process(async (job, done) => {
  const { user, call } = job.data;
  try {
    await sendEmailNotificationReminder(user, call);
    console.log(`✅ Reminder email sent to ${user.email}`);
    done();
  } catch (err) {
    console.error("❌ Email reminder failed:", err.message);
    done(err);
  }
});
