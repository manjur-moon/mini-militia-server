process.env.NODE_ENV = "test";
process.env.PORT = "5001";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
process.env.MONGODB_DB_NAME = "mini_militia_test";
process.env.CLIENT_ORIGINS = "http://localhost:5173";
process.env.BETTER_AUTH_URL = "http://localhost:5001";
process.env.BETTER_AUTH_SECRET =
  "test-secret-that-is-longer-than-thirty-two-characters";
process.env.BETTER_AUTH_COOKIE_PREFIX = "mini_militia_test";
process.env.AUTH_COOKIE_SAME_SITE = "lax";
process.env.LOG_LEVEL = "error";

process.env.CLOUDINARY_PLAYER_FOLDER = "mini-militia/test-players";
