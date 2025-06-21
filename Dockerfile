# Use an official lightweight Python image.
FROM python:3.9-slim

# Set the working directory in the container.
WORKDIR /app

# Copy the requirements file first to leverage Docker cache.
COPY requirements.txt .

# Install the dependencies.
RUN pip install -r requirements.txt

# Copy the rest of the application's code.
COPY . .

# Expose the port the app runs on.
EXPOSE 5000

# Define the command to run the application using a production-ready server.
# We use gunicorn, which should be added to requirements.txt.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]