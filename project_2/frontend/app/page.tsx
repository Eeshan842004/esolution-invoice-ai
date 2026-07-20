import Header from "./components/Header";
import ChatInterface from "./components/ChatInterface";

export default function Home() {
  return (
    <div className="flex h-full flex-col">
      <Header />
      <ChatInterface />
    </div>
  );
}
