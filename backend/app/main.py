from fastapi import FastAPI
app = FastAPI(title="HRM Backend")

@app.get("/")
def root():
    return {"message": "HRM backend is running"}