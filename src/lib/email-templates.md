# Customizing Supabase Email Templates

To customize the email confirmation template in Supabase, follow these steps:

## 1. Access Supabase Dashboard

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to the "Authentication" section in the left sidebar
4. Click on the "Email Templates" tab

## 2. Customize Confirmation Email

In the Email Templates section, you'll find several templates. For the confirmation email:

1. Select the "Confirmation" template
2. You can customize:
   - **Subject**: Change the email subject line
   - **Content**: Modify the HTML content of the email
   - **Variables**: Use variables like `{{ .SiteURL }}`, `{{ .Token }}`, etc.

## 3. Example Custom Template

Here's an example of a more engaging confirmation email template:

### Subject:
```
Welcome to Technician Service ERP - Confirm Your Email
```

### Content:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Welcome to Technician Service ERP</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      color: #2563eb;
      font-size: 24px;
      font-weight: bold;
    }
    .content {
      background-color: #f8fafc;
      border-radius: 8px;
      padding: 30px;
      margin-bottom: 20px;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      text-decoration: none;
      font-weight: bold;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #64748b;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🔧 Technician Service ERP</div>
  </div>
  
  <div class="content">
    <h2>Welcome to Technician Service ERP!</h2>
    <p>Thank you for registering with our platform. To complete your registration and access all features, please confirm your email address by clicking the button below:</p>
    
    <a href="{{ .ConfirmationURL }}" class="button">Confirm Your Email</a>
    
    <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
    <p>{{ .ConfirmationURL }}</p>
    
    <p>This link will expire in 24 hours for security reasons.</p>
  </div>
  
  <div class="footer">
    <p>© 2023 Technician Service ERP. All rights reserved.</p>
    <p>If you didn't create an account with us, please ignore this email.</p>
  </div>
</body>
</html>
```

## 4. Additional Tips

1. **Branding**: Use your company's colors, logo, and branding elements
2. **Mobile Responsiveness**: Ensure the email looks good on mobile devices
3. **Clear Call-to-Action**: Make the confirmation button prominent and clear
4. **Personalization**: Use variables to personalize the email with the user's information
5. **Security Information**: Include information about link expiration for security

## 5. Testing

After customizing the template:

1. Create a test account to see how the email looks
2. Check the email on different devices and email clients
3. Verify that the confirmation link works correctly

## 6. Other Email Templates

You can also customize other email templates in the same way:
- Password Reset
- Magic Link
- Email Change
- Re-authentication

Each template can be customized to match your brand and provide a better user experience.