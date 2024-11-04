// todo
import "./style.css";

const helloWorldBtn = document.createElement("button");
helloWorldBtn.textContent = "Click Me!";
helloWorldBtn.addEventListener("click", () => {
  alert("You clicked the button!");
});
document.getElementById("app")?.append(helloWorldBtn);
