const dotenv = require("dotenv");
dotenv.config();
const { TwitterClient } = require("twitter-api-client");
const axios = require("axios");
const sharp = require("sharp");
const fs = require("fs");

// for byepassing heroku $PORT error
const { http, onRequest } = require("http");

const twitterClient = new TwitterClient({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_SECRET,
  accessToken: process.env.ACCESS_KEY,
  accessTokenSecret: process.env.ACCESS_SECRET,
});

async function get_followers() {
  const followers = await twitterClient.accountsAndUsers.followersList({
    count: 3,
  });

  const image_data = [];
  let count = 0;

  const get_followers_img = new Promise((resolve, reject) => {
    followers.users.forEach((follower, index, arr) => {
      process_image(
        follower.profile_image_url_https,
        `${follower.screen_name}.png`
      ).then(() => {
        const follower_avatar = {
          input: `${follower.screen_name}.png`,
          top: 380,
          left: parseInt(`${1050 + 120 * index}`),
        };
        image_data.push(follower_avatar);
        count++;
        if (count === arr.length) resolve();
      });
    });
  });

  get_followers_img.then(() => {
    draw_image(image_data);
  });
}

async function process_image(url, image_path) {
  await axios({
    url,
    responseType: "arraybuffer",
  }).then(
    (response) =>
      new Promise(async (resolve, reject) => {
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

async function create_text(width, height, text) {
  try {
    const svg_img = `
    <svg width="${width}" height="${height}">
    <style>
    .text {
      font-size: 64px;
      fill: #000;
      font-weight: 700;
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

async function draw_image(image_data) {
  try {
    const hour = new Date().getHours();
    const welcomeTypes = ["Morning", "Afternoon", "Evening"];
    let welcomeText = "";

    if (hour < 12) welcomeText = welcomeTypes[0];
    else if (hour < 18) welcomeText = welcomeTypes[1];
    else welcomeText = welcomeTypes[2];

    const svg_greeting = await create_text(540, 100, welcomeText);

    image_data.push({
      input: svg_greeting,
      top: 52,
      left: 220,
    });

    await sharp("twitter-banner.png")
      .composite(image_data)
      .toFile("new-twitter-banner.png");

    upload_banner(image_data);
  } catch (error) {
    console.log(error);
  }
}

async function upload_banner(files) {
  try {
    const base64 = fs.readFileSync("new-twitter-banner.png", {
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
      if (file.input.includes(".png")) {
        fs.unlinkSync(file.input);
        console.log("File removed");
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

// bypass heroku port error
http.createServer(onRequest).listen(process.env.PORT || 6000);
