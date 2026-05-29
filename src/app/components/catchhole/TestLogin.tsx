export default function TestLogin() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0F0F13] text-[#F0F0F5]">
      <div className="bg-[#1A1A22] border border-[#2A2A36] p-8 rounded-lg w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center tracking-tight">CatchHole Login</h1>
        <div className="flex flex-col gap-4">
          <input 
            type="email" 
            placeholder="Email address" 
            className="bg-transparent border border-[#2A2A36] rounded px-4 py-2 text-sm focus:border-[#7C5CFC] outline-none transition-colors"
          />
          <input 
            type="password" 
            placeholder="Password" 
            className="bg-transparent border border-[#2A2A36] rounded px-4 py-2 text-sm focus:border-[#7C5CFC] outline-none transition-colors"
          />
          <button className="bg-[#7C5CFC] text-white font-semibold py-2 rounded mt-2 hover:brightness-110 transition-all">
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
