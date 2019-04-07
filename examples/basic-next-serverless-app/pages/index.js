import React from "react";
import "./styles/home.css";

function Index() {
  return (
    <div className="homePage">
      <div>Welcome to next.js serverless ⚡</div>
    </div>
  );
}

Index.getInitialProps = () => {
  throw new Error("Blew up");
};

export default Index;
