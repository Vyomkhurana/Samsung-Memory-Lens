import express from "express";
import bodyParser from "body-parser";
import ejs from "ejs";

const app = express();

app.get("/", (req,res)=>{
    res.render("home.ejs");
})

app.listen(3000, (req,res)=>{
    console.log("http://localhost:3000");
})
