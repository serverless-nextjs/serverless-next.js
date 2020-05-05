import React from "react";
import Link from "next/link";

import "./styles/home.css";

function Index() {
  return (
    <div className="homePage">
      <div>Welcome to next.js serverless ⚡</div>
      <br />
      <div>
        Visit the{" "}
        <Link href="/about">
          <a>about</a>
        </Link>{" "}
        page
      </div>
    </div>
  );
}

export default Index;
