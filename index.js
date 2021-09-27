const dotenv = require("dotenv");
dotenv.config();
const { TwitterClient } = require("twitter-api-client");
const axios = require("axios");
const sharp = require("sharp");
const fs = require("fs");

const twitterClient = new TwitterClient({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_SECRET,
  accessToken: process.env.CONSUMER_KEY,
  accessTokenSecret: process.env.CONSUMER_SECRET,
});

async function get_followers() {
  const followers = await twitterClient.accountsAndUsers.followersList({
    screen_name: process.env.TWITTER_HANDLE,
    count: 3,
  });

  const followers_info = [];

  const get_followers_img = new Promise((resolve, reject) => {
    followers.users.forEach((follower, index) => {
      process_image(
        follower.profile_image_url_https,
        `${follower.screen_name}-${index}.png`
      );
      const follower_avatar = {
        input: `${follower.screen_name}-${index}.png`,
        top: 675,
        left: parseInt(`${1220 + 120 * index}`),
      };
      followers_info.push(follower_avatar);
      resolve();
    });
  });

  get_followers_img.then(() => {
    draw_image(followers_info);
  });
}

async function process_image(url, image_path) {
  await axios({
    url,
    responseType: "arraybuffer",
  }).then(
    (response) =>
      new Promise((resolve, reject) => {
        const rounded_corners = new Buffer.from(
          '<svg><rect x="0" y="0" width="100" height="100" rx="50" ry="50"/></svg>'
        );
        resolve(
          sharp(response.data)
            .resize(100, 100)
            .composite([
              {
                input: rounded_corners,
                blend: "dest-in",
              },
            ])
            .png()
            .toFile(image_path)
        );
      })
  );
}

async function create_text(width, length, text) {
  try {
    const svg_img = `
    <svg width="${width}" height="${length}">
    <style>
    .text {
      font-size: 64px;
      color: #fff;
      fill: #fff;
    }
    </style>
    <text x="50%" y="50%" text-anchor="middle" class="text">${text}</text>
    </svg>
    `;
    const svg_img_buffer = Buffer.from(svg_img);
    return svg_img_buffer;
  } catch (error) {
    console.log(error);
  }
}

async function draw_image(followers_info) {
  try {
    /*   const svg_banner_followers = await create_text(
      100,
      100,
      draw_image_details.total_followers
    );
    draw_image_details.followers_info.push({
      input: svg_banner_followers,
      top: 518,
      left: 908,
    });
 */
    await sharp("twitter-banner.png")
      .composite(followers_info)
      .toFile("new-twitter-banner.png");

    upload_banner(followers_info);
  } catch (error) {
    console.log(error);
  }
}

async function upload_banner(files) {
  try {
    const base64 = await fs.readFileSync("new-twitter-banner.png", {
      encoding: "base64",
    });
    await twitterClient.accountsAndUsers
      .accountUpdateProfileBanner({
        banner: base64,
      })
      .then(() => {
        console.log("Upload to Twitter done");
        delete_files(files);
      });
  } catch (error) {
    console.log(error);
  }
}

async function delete_files(files) {
  try {
    files.forEach((file) => {
      if (!file.input.startsWith("<Buffer")) {
        fs.unlinkSync(file.input);
        console.log("Files removed", file.input);
      }
    });
  } catch (err) {
    console.error(err);
  }
}

get_followers();
setInterval(() => {
  get_followers();
}, 60000);
