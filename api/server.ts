import express from "express";
import { adminApiRouter } from "../src/lib/admin-api.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/", adminApiRouter);

export default app;
