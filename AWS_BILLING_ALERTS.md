# AWS Billing Alerts & Cost Management Setup

## 🎯 Goal
Set up real-time billing alerts and cost monitoring so you (and your dad) get notified **before** going over budget, preventing surprise charges like the $30 incident.

## 📧 What We'll Set Up

1. **Billing Alerts** - Get notified at 50%, 75%, 90%, and 100% of your monthly budget
2. **Cost Budgets** - Track spending in real-time
3. **Email Notifications** - Send alerts to your dad's email
4. **Resource Usage Alarms** - Monitor CPU, storage, and network usage

---

## 🚀 Step 1: Enable Billing Alerts (Required First Step)

**Important:** You must enable billing alerts before you can create them.

1. **Go to AWS Billing Console:**
   - Sign in to AWS Console
   - Search for "Billing" in the top search bar
   - Click "Billing"

2. **Enable Billing Alerts:**
   - In the left sidebar, click "Billing preferences"
   - Scroll down to "Billing preferences"
   - Check the box: **"Receive Billing Alerts"**
   - Click "Save preferences"

---

## 📊 Step 2: Create Billing Alerts (CloudWatch)

### Option A: Using AWS Console (Easiest)

1. **Go to CloudWatch:**
   - In AWS Console, search for "CloudWatch"
   - Click "CloudWatch"

2. **Create Billing Alarm:**
   - In left sidebar, click "Alarms" → "All alarms"
   - Click "Create alarm"
   - Click "Select metric"
   - Under "Billing", click "Total Estimated Charge"
   - Select your currency (e.g., "USD")
   - Click "Select metric"

3. **Configure Alarm:**
   - **Alarm name:** `Monthly-Billing-Alert-50-Percent`
   - **Threshold type:** Static
   - **Whenever EstimatedCharges is...:** Greater than threshold
   - **Threshold value:** Enter your monthly budget × 0.5 (e.g., if budget is $10, enter `5`)
   - Click "Next"

4. **Configure Actions:**
   - **Notification:** Create new SNS topic
   - **Topic name:** `billing-alerts`
   - **Email addresses:** Add your dad's email (and yours if you want)
   - Click "Create topic"
   - Click "Next"

5. **Review and Create:**
   - Review settings
   - Click "Create alarm"

6. **Repeat for Other Thresholds:**
   Create additional alarms for:
   - 75% of budget
   - 90% of budget
   - 100% of budget (critical!)

### Option B: Quick Setup Script

If you want to set up multiple alerts at once, you can use AWS CLI:

```bash
# Install AWS CLI (if not installed)
# Windows: Download from https://aws.amazon.com/cli/
# Or use: winget install Amazon.AWSCLI

# Configure AWS credentials
aws configure
# Enter your Access Key ID, Secret Access Key, region (e.g., ca-central-1)

# Create SNS topic for billing alerts
aws sns create-topic --name billing-alerts
# Note the TopicArn from output

# Subscribe your dad's email
aws sns subscribe \
  --topic-arn <TOPIC_ARN_FROM_ABOVE> \
  --protocol email \
  --notification-endpoint your-dad@email.com

# Create billing alarms (example for $10/month budget)
aws cloudwatch put-metric-alarm \
  --alarm-name "Billing-50-Percent" \
  --alarm-description "Alert when 50% of monthly budget reached" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --evaluation-periods 1 \
  --threshold 5.0 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions <TOPIC_ARN> \
  --dimensions Name=Currency,Value=USD

# Repeat for 75%, 90%, 100%
```

---

## 💰 Step 3: Create Cost Budgets (More Detailed Tracking)

Cost Budgets give you more detailed tracking and can alert on specific services.

1. **Go to AWS Budgets:**
   - In AWS Console, search for "Budgets"
   - Click "Budgets"

2. **Create Budget:**
   - Click "Create budget"
   - Select "Cost budget" → "Next"

3. **Configure Budget:**
   - **Budget name:** `Monthly-Crawler-Budget`
   - **Period:** Monthly
   - **Budget amount:** Fixed amount
   - **Amount:** Enter your monthly budget (e.g., `10`)
   - Click "Next"

4. **Set Alerts:**
   - **Alert 1:**
     - **Alert threshold:** 50%
     - **Email contacts:** Add your dad's email
   - **Alert 2:**
     - **Alert threshold:** 75%
     - **Email contacts:** Add your dad's email
   - **Alert 3:**
     - **Alert threshold:** 90%
     - **Email contacts:** Add your dad's email
   - **Alert 4:**
     - **Alert threshold:** 100%
     - **Email contacts:** Add your dad's email
   - Click "Next"

5. **Review and Create:**
   - Review settings
   - Click "Create budget"

---

## 📈 Step 4: Monitor Resource Usage (Optional but Recommended)

Set up alarms for resource usage to catch issues early:

### CPU Usage Alarm

1. **Go to CloudWatch → Alarms**
2. **Create alarm:**
   - **Metric:** EC2 → Per-Instance Metrics → `CPUUtilization`
   - **Instance:** Select your Lightsail instance
   - **Threshold:** 80% (or whatever you prefer)
   - **Actions:** Send email notification
   - **Name:** `Lightsail-High-CPU`

### Storage Usage Alarm

1. **Create alarm:**
   - **Metric:** EC2 → Per-Instance Metrics → `DiskSpaceUtilization`
   - **Threshold:** 80%
   - **Actions:** Send email notification
   - **Name:** `Lightsail-High-Storage`

### Network Usage Alarm

1. **Create alarm:**
   - **Metric:** EC2 → Per-Instance Metrics → `NetworkIn` or `NetworkOut`
   - **Threshold:** Set based on your plan limits
   - **Actions:** Send email notification
   - **Name:** `Lightsail-High-Network`

---

## 📧 Step 5: Verify Email Notifications

1. **Check Email:**
   - Your dad (and you) should receive a confirmation email from AWS SNS
   - Click the confirmation link in the email
   - This subscribes the email to receive alerts

2. **Test Alert:**
   - You can test by temporarily lowering a threshold to trigger an alert
   - Or wait for the first actual alert

---

## 🎯 Recommended Alert Thresholds

For a typical Lightsail instance ($5-10/month):

| Alert | Threshold | Purpose |
|------|-----------|---------|
| **Early Warning** | 50% ($2.50-$5) | "Hey, we're halfway through the month" |
| **Getting Close** | 75% ($3.75-$7.50) | "We're at 3/4, keep an eye on it" |
| **Almost There** | 90% ($4.50-$9) | "We're almost at the limit!" |
| **Critical** | 100% ($5-$10) | "STOP! We hit the budget!" |

---

## 📱 Step 6: Set Up AWS Mobile App (Optional)

Your dad can monitor costs on his phone:

1. **Download AWS Mobile App:**
   - iOS: App Store
   - Android: Google Play

2. **Sign in with AWS credentials**

3. **View costs in real-time:**
   - Go to "Billing" section
   - See current month's spending
   - View alerts and budgets

---

## 🔍 Step 7: Check Current Costs

To see what you're currently spending:

1. **AWS Console → Billing Dashboard:**
   - See current month's charges
   - See forecasted charges
   - See service breakdown

2. **AWS Cost Explorer:**
   - More detailed cost analysis
   - Historical data
   - Cost trends

---

## ⚠️ Important Notes

### Lightsail Pricing
- **Fixed monthly price** for your instance (e.g., $5/month for 1GB RAM)
- **Additional charges** only if you:
  - Exceed included data transfer (usually 1TB/month)
  - Use additional services (S3, CloudWatch, etc.)
  - Create snapshots (charged per GB)

### What the Crawler Uses
- **Compute:** Included in Lightsail price
- **Storage:** Included in Lightsail price (40GB)
- **Data Transfer:** 
  - Crawling external sites uses data transfer
  - Usually well within 1TB limit
  - Monitor if crawling many external sites

### Cost Control Tips
1. **Set max pages limit** (already done: 2000)
2. **Set max depth limit** (already done: 5)
3. **Monitor data transfer** in Lightsail console
4. **Stop crawler when done** (`pm2 stop crawler`)

---

## 🛠️ Troubleshooting

### Alerts Not Working?

1. **Check billing alerts are enabled:**
   - Billing → Billing preferences → "Receive Billing Alerts" must be checked

2. **Check email subscription:**
   - CloudWatch → SNS → Topics → `billing-alerts`
   - Make sure email is "Confirmed"

3. **Check alarm state:**
   - CloudWatch → Alarms
   - Should show "OK" or "ALARM" (not "INSUFFICIENT_DATA")

### Can't See Billing Data?

- Billing data can take up to 24 hours to appear
- Make sure you have billing permissions
- Check you're in the correct AWS account

---

## 📋 Quick Checklist

- [ ] Enable billing alerts in Billing preferences
- [ ] Create CloudWatch billing alarms (50%, 75%, 90%, 100%)
- [ ] Create SNS topic and subscribe emails
- [ ] Create Cost Budget with alerts
- [ ] Verify email confirmations received
- [ ] Test one alert (optional)
- [ ] Set up resource usage alarms (optional)
- [ ] Download AWS mobile app (optional)

---

## 🎉 Done!

Once set up, your dad will receive email alerts:
- When spending reaches 50% of budget
- When spending reaches 75% of budget
- When spending reaches 90% of budget
- When spending reaches 100% of budget (critical!)

**No more surprise $30 charges!** 🎊

---

## 📞 Need Help?

If you need help setting this up:
1. Check AWS documentation: https://docs.aws.amazon.com/awsaccountbilling/
2. AWS Support (if you have support plan)
3. AWS Community Forums


