ALTER TABLE "Wallet"
ADD CONSTRAINT "wallet_cash_non_negative" CHECK ("cashBalance" >= 0),
ADD CONSTRAINT "wallet_bonus_non_negative" CHECK ("bonusBalance" >= 0);
