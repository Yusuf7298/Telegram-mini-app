import express from "express";
import cors from "cors";
import userRoutes from "./modules/user/user.routes";
import walletRoutes from "./modules/wallet/wallet.routes";
import gameRoutes from "./modules/game/game.routes";
import vaultRoutes from "./modules/vault/vault.routes";
import authRoutes from "./modules/auth/auth.routes";
import { authMiddleware } from "./middleware/auth.middleware";


const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

app.use("/api/auth", authRoutes);
app.use("/api", authMiddleware);
app.use("/api/user", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/vault", vaultRoutes);
app.listen(5000, () => {
  console.log("Server running on port 5000");
});

app.get("/test", async (req, res) => {
  res.send("Working ✅");
});