import { achievementService } from "../services/achievement.service.js";
import { challengeService } from "../services/challenge.service.js";
import { mvpConfigService } from "../services/mvp-config.service.js";
import { ratingConfigService } from "../services/rating-config.service.js";
import { titleService } from "../services/title.service.js";
import { connectToDatabase, disconnectFromDatabase } from "../config/database.js";
import { logger } from "../config/logger.js";

async function seedProductionDefaults() {
  await connectToDatabase();

  await titleService.ensureDefaultTitles();
  await achievementService.ensureDefaultAchievements();
  await challengeService.ensureDefaultChallenges();
  await mvpConfigService.getActiveConfig();
  await ratingConfigService.getActiveConfig();

  logger.info("Production default data is ready.", {
    seededModules: [
      "dynamic_titles",
      "achievements",
      "challenges",
      "mvp_config",
      "rating_config",
    ],
  });
}

seedProductionDefaults()
  .catch((error) => {
    logger.error("Production default seeding failed.", {
      error: error.message,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase();
  });
