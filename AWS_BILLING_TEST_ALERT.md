# AWS Billing Test Alert Setup ($0.01)

## 🎯 Goal
Set up a test billing alert at $0.01 to verify the notification system works before setting up real alerts.

---

## 📋 Prerequisites

Before starting, make sure:
- [ ] You're signed in to AWS Console
- [ ] You have your email ready for testing
- [ ] Billing alerts are enabled (see main AWS_BILLING_ALERTS.md if not)

---

## 🚀 Step-by-Step Setup

### Step 1: Enable Billing Alerts (If Not Already Done)

1. **Go to AWS Billing Console:**
   - In AWS Console, search for "Billing" in the top search bar
   - Click "Billing"

2. **Enable Billing Alerts:**
   - In the left sidebar, click "Billing preferences"
   - Scroll down to "Billing preferences"
   - Check the box: **"Receive Billing Alerts"**
   - Click "Save preferences"
   - ⏰ Wait 15 minutes for this to take effect

---

### Step 2: Create CloudWatch Billing Alarm

1. **Go to CloudWatch:**
   - In AWS Console, search for "CloudWatch"
   - Click "CloudWatch"

2. **Start Creating Alarm:**
   - In left sidebar, click "Alarms" → "All alarms"
   - Click the orange "Create alarm" button

3. **Select Metric:**
   - Click "Select metric"
   - Click "Billing" (under AWS namespaces)
   - Click "Total Estimated Charge"
   - Select the checkbox next to "USD" (or your currency)
   - Click "Select metric" button at bottom right

---

### Step 3: Configure Alarm Conditions

1. **Metric and Conditions:**
   - **Statistic:** Maximum (should be selected by default)
   - **Period:** 6 hours (or keep default)
   
2. **Conditions:**
   - **Threshold type:** Static
   - **Whenever EstimatedCharges is...:** Greater
   - **than...:** `0.01`
   - Type exactly: `0.01`
   
3. **Click "Next"** at bottom right

---

### Step 4: Configure Actions (THIS IS YOUR CURRENT SCREEN)

You should now see the "Configure actions" page with notification blocks.

1. **Remove Duplicate Notification (if present):**
   - If you see TWO notification blocks, click "Remove" on the second one
   - Keep only ONE notification block

2. **Configure the Notification:**
   
   **Alarm state trigger:**
   - Keep **"In alarm"** selected ✓ (already correct)
   
   **SNS Topic - Choose ONE option:**
   
   **Option A: Create New Topic (Recommended for Testing)**
   - Select **"Create new topic"** (second radio button)
   - **Topic name:** Enter `billing-alerts-test`
   - **Email endpoints:** Enter YOUR email address (for testing)
   - Click "Create topic" button
   
   **Option B: Use Existing Topic (If You Already Have One)**
   - Keep **"Select an existing SNS topic"** selected
   - Click the dropdown "Select an SNS topic"
   - Choose your existing topic (e.g., "billing-alerts")

3. **Click "Next"** at bottom right

---

### Step 5: Add Alarm Name and Description

1. **Name and Description:**
   - **Alarm name:** `Test-Billing-Alert-0-01`
   - **Alarm description:** `Test alert to verify billing notifications work - triggers at $0.01`

2. **Preview:**
   - Review the alarm configuration
   - Should show: "Alarm when EstimatedCharges > 0.01 USD"

3. **Click "Next"**

---

### Step 6: Review and Create

1. **Review All Settings:**
   - **Metric:** EstimatedCharges
   - **Threshold:** 0.01 USD
   - **Notification:** Your email via SNS topic
   
2. **Click "Create alarm"** (orange button at bottom right)

---

## 📧 Step 7: Confirm Email Subscription

**IMPORTANT:** You must confirm the email subscription!

1. **Check Your Email:**
   - Within 5 minutes, you should receive an email from AWS Notifications
   - Subject: "AWS Notification - Subscription Confirmation"
   - Sender: no-reply@sns.amazonaws.com

2. **Confirm Subscription:**
   - Open the email
   - Click the "Confirm subscription" link
   - You'll see a confirmation page in your browser
   - ✅ You're now subscribed!

**If you don't receive the email:**
- Check spam/junk folder
- Wait up to 15 minutes
- Verify email address was entered correctly

---

## ⏰ Step 8: Wait for Alert to Trigger

Since your threshold is $0.01, the alarm should trigger within 24 hours (or immediately if you already have charges).

**What happens:**
1. AWS updates billing data (every 6-8 hours)
2. CloudWatch checks if charges > $0.01
3. If yes → Sends email notification to you
4. You receive email: "ALARM: Test-Billing-Alert-0-01 in US East (N. Virginia)"

**Timeline:**
- If you have NO current charges: Alert triggers when first charge appears
- If you ALREADY have charges > $0.01: Alert triggers within 6-8 hours

---

## ✅ Step 9: Verify It Works

When you receive the alert email:

1. **Check Email Content:**
   - Subject should say "ALARM: Test-Billing-Alert-0-01"
   - Body should show current estimated charges
   - Should show threshold: $0.01

2. **Check CloudWatch:**
   - Go to CloudWatch → Alarms
   - Your alarm should show state: "ALARM" (red)
   - This means it's working! ✅

---

## 🎉 Step 10: Clean Up Test Alert (After Verification)

Once you've confirmed the alert works:

1. **Delete Test Alarm:**
   - Go to CloudWatch → Alarms
   - Select "Test-Billing-Alert-0-01"
   - Click "Actions" → "Delete"
   - Confirm deletion

2. **Create Real Alerts:**
   - Follow the same steps above, but with realistic thresholds:
     - Alert 1: $5 (50% of $10 budget)
     - Alert 2: $7.50 (75% of $10 budget)
     - Alert 3: $9 (90% of $10 budget)
     - Alert 4: $10 (100% of $10 budget)

3. **Add Your Dad's Email:**
   - Go to CloudWatch → SNS → Topics
   - Click on your SNS topic
   - Click "Create subscription"
   - Protocol: Email
   - Endpoint: Your dad's email
   - Click "Create subscription"
   - He'll need to confirm via email

---

## 🔍 Troubleshooting

### "Insufficient Data" State
- **Cause:** Billing data hasn't been collected yet
- **Solution:** Wait 24 hours for AWS to collect billing data
- The alarm will automatically switch to "OK" or "ALARM" once data is available

### No Email Received
- **Check:** Spam/junk folder
- **Check:** Email subscription status in SNS (must be "Confirmed")
- **Check:** Email address was entered correctly
- **Resend:** Go to SNS → Subscriptions → Select subscription → "Request confirmation"

### Alarm Not Triggering
- **Check:** Current charges in Billing Dashboard
- **Check:** Alarm threshold is correct (0.01)
- **Check:** Alarm state in CloudWatch (should be "ALARM" if charges > $0.01)
- **Wait:** Billing data updates every 6-8 hours

---

## 💡 Pro Tips

1. **Test with your own email first** before adding your dad's email
2. **Use a descriptive alarm name** so you know what it's for
3. **Set a calendar reminder** to check the alarm in 24 hours
4. **Take a screenshot** of the alarm configuration for reference
5. **Document the SNS topic ARN** - you'll need it for future alarms

---

## 📞 Quick Reference

**Your Configuration:**
- Threshold: $0.01 USD
- Alarm name: `Test-Billing-Alert-0-01`
- SNS topic: `billing-alerts-test`
- Email: [Your email for testing]
- Expected trigger: Within 24 hours

**Next Steps After Test:**
1. ✅ Verify email received
2. ✅ Delete test alarm
3. ✅ Create real alarms with proper thresholds
4. ✅ Add dad's email to SNS topic
5. ✅ Confirm dad receives confirmation email

---

## 🎊 Success Criteria

You'll know it's working when:
- ✅ Email subscription confirmed
- ✅ Alarm shows "ALARM" state in CloudWatch
- ✅ You receive alert email with billing details
- ✅ Email clearly shows threshold exceeded

**Once verified, you can confidently set up real alerts!**








