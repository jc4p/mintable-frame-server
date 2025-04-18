# AWS Setup Guide for Mintable Frame Server

This guide provides step-by-step instructions for deploying the Mintable Frame Server on an AWS EC2 t4g.micro instance with Nginx, systemd, and securing it with Cloudflare.

## 1. Launch an AWS EC2 Instance

1. Log in to your AWS Management Console
2. Navigate to EC2 Service
3. Click "Launch Instance"
4. Configure your instance:
   - Name: `mintable-frame-server`
   - AMI: Amazon Linux 2023 (arm64)
   - Instance type: t4g.micro (ARM-based)
   - Key pair: Create a new key pair or select an existing one
   - Network settings: Allow HTTP (80) and SSH (22)
   - Configure storage: Default (8 GB gp3) is sufficient
5. Click "Launch Instance"

## 2. Connect to Your EC2 Instance

```bash
ssh -i /path/to/your-key.pem ec2-user@your-instance-public-ip
```

## 3. Install Required Software

### Update the System

```bash
sudo dnf update -y
```

### Install Nginx

```bash
sudo dnf install nginx -y
```

### Install Git

```bash
sudo dnf install git -y
```

### Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or restart your shell
```

## 4. Clone and Configure the Application

### Clone the Repository

```bash
mkdir -p ~/apps
cd ~/apps
git clone https://github.com/jc4p/mintable-frame-server.git
cd mintable-frame-server
```

### Install Dependencies

```bash
bun install
```

### Customize NFT Metadata

Before deploying, you should customize the NFT metadata to match your own collection:

1. Edit the `server.js` file:

```bash
nano ~/apps/mintable-frame-server/server.js
```

2. Find the `generateNftMetadata` function (around line 6) and update it with your own values:

```javascript
const generateNftMetadata = (tokenId) => {
  return {
    // Change this to your NFT's name format
    name: `Your NFT Name #${tokenId}`,
    
    // Update with your collection's description 
    description: "Description of your amazing NFT collection",
    
    // IMPORTANT: Replace with the URL to your own image
    // Must be a publicly accessible URL
    image: "https://your-domain.com/path/to/your/image.jpg",
    
    // Customize attributes for your NFTs
    attributes: [
      {
        trait_type: "Collection",
        value: "Your Collection Name"
      },
      {
        trait_type: "Token ID",
        value: tokenId.toString()
      },
      // Add additional attributes as needed
      {
        trait_type: "Rarity",
        value: "Common"
      }
    ]
  };
};
```

#### Image Hosting Options

For the `image` URL, you'll need to host your NFT image somewhere publicly accessible:

#### Updating the Root Route

Don't forget to also update the root route information to match your NFT collection name:

```javascript
// Find this section in server.js (around line 30)
app.get('/', () => {
  return {
    name: "NFT Metadata API",
    description: "API for Your Collection Name NFT metadata", // Update this line
    endpoints: {
      tokens: "/tokens/{tokenId}"
    }
  };
});
```

1. **AWS S3 (recommended for this setup)**:
   ```bash
   # Install AWS CLI
   curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   
   # Configure AWS CLI with your credentials
   aws configure
   
   # Create an S3 bucket (replace bucket-name with your preferred name)
   aws s3 mb s3://your-nft-images-bucket
   
   # Upload your image (replace with your actual image path and name)
   aws s3 cp your-image.jpg s3://your-nft-images-bucket/
   
   # Make the object public
   aws s3api put-object-acl --bucket your-nft-images-bucket --key your-image.jpg --acl public-read
   
   # Your image URL will be:
   # https://your-nft-images-bucket.s3.amazonaws.com/your-image.jpg
   ```

2. **Use a dedicated image hosting service** like Imgur, Cloudinary, or IPFS
3. **Host on your own server** alongside this metadata server

### Test the Application Manually

After customizing your metadata, verify the application works:

```bash
# Start the server in the foreground
bun start
```

Open another SSH session to your server in a new terminal tab/window:

```bash
ssh -i /path/to/your-key.pem ec2-user@your-instance-public-ip
```

Then test the API endpoints:

```bash
curl localhost:3000
# Should return API information

curl localhost:3000/tokens/1
# Should return metadata for token #1
```

If everything works correctly, you can stop the server in the first terminal (Ctrl+C) and proceed with setting up systemd.

## 5. Set Up Systemd Service for the Application

Create a systemd service file:

```bash
sudo tee /etc/systemd/system/mintable-frame.service > /dev/null << 'EOF'
[Unit]
Description=Mintable Frame Server
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/apps/mintable-frame-server
ExecStart=/home/ec2-user/.bun/bin/bun start
Restart=on-failure
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF
```

Reload systemd to recognize the new service file, then enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mintable-frame
sudo systemctl start mintable-frame
```

Check the status:

```bash
sudo systemctl status mintable-frame
```

## 6. Configure Nginx as a Reverse Proxy

Remove the default Nginx configuration:

```bash
sudo rm /etc/nginx/nginx.conf
```

Create a new Nginx configuration:

```bash
sudo tee /etc/nginx/nginx.conf > /dev/null << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /run/nginx.pid;

include /usr/share/nginx/modules/*.conf;

events {
    worker_connections 1024;
}

http {
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile            on;
    tcp_nopush          on;
    keepalive_timeout   65;
    types_hash_max_size 4096;

    include             /etc/nginx/mime.types;
    default_type        application/octet-stream;

    server {
        listen       80;
        listen       [::]:80;
        server_name  _;  # Catch-all for any domain, if in the future you want multiple servers on this machine you can update this to be the specific domain/subdomain you're targetting

        # Cloudflare will handle HTTPS, we only need HTTP here
        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
EOF
```

Test the Nginx configuration:

```bash
sudo nginx -t
```

If the test is successful, enable and restart Nginx:

```bash
sudo systemctl daemon-reload
sudo systemctl enable nginx
sudo systemctl restart nginx
```

## 7. Set Up Cloudflare for DNS and HTTPS

1. Create a Cloudflare account if you don't have one: https://dash.cloudflare.com/sign-up

2. Add your domain to Cloudflare:
   - Go to the Cloudflare dashboard
   - Click "Add a Site"
   - Enter your domain name and follow the setup wizard
   - Update your domain's nameservers to the ones provided by Cloudflare

3. Configure DNS settings:
   - In the DNS section of your Cloudflare dashboard
   - Add an A record:
     - Type: A
     - Name: @ (or subdomain like 'nft-api')
     - Content: Your EC2 instance's public IP address
     - Proxy status: Proxied (cloud icon should be orange)
     - TTL: Auto

4. Configure SSL/TLS settings:
   - Go to the SSL/TLS section
   - Set SSL/TLS encryption mode to "Flexible"
   - Enable "Always Use HTTPS" in the Edge Certificates tab

## 8. Test Your Setup

### Verify Local Server Setup

First, test that the server works locally through nginx:

```bash
# Test direct connection to the application
curl localhost:3000
# Should return API information with your customized collection name
curl localhost:3000/tokens/1
# Should return metadata for token #1 with your customized values

# Test through nginx
curl localhost
curl localhost/tokens/1
```

All of these requests should return successful responses.

### Verify With Domain After Cloudflare Setup

After completing Cloudflare setup, test that everything works through your domain (you can run this locally on your machine, not necessary to run it on the server):

```bash
curl https://your-domain.com
curl https://your-domain.com/tokens/1
```

## Troubleshooting

### View Application Logs

```bash
sudo journalctl -u mintable-frame -f
```

### View Nginx Logs

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Common Issues

1. **Application not starting**: Check systemd logs and ensure Bun is installed correctly.
   ```bash
   sudo systemctl status mintable-frame
   ```

2. **Nginx not working**: Verify the configuration syntax and check error logs.
   ```bash
   sudo nginx -t
   ```

3. **Can't access the site**: Check AWS security groups to ensure port 80 is open.

4. **Cloudflare not connecting**: Verify DNS settings and ensure you're using the correct IP address.
