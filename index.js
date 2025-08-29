import express from "express";
import bodyParser from "body-parser";
import ejs from "ejs";

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.get("/", (req,res)=>{
    res.render("home.ejs");
})

app.listen(3000, ()=>{
    console.log("http://localhost:3000");
})
